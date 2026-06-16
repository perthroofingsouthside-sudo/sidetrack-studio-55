"""Stripe payment routes for Pocket Products subscription tiers."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db
from datetime import datetime, timezone, timedelta
import os
import logging
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter()

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# Fixed tier prices — NEVER accept amounts from frontend (USD subscriptions)
TIER_PRICES = {
    "listener": 4.98,
    "individual": 11.98,
    "individual_covers": 15.98,
    "student": 9.98,
    "couple_duo": 14.98,
    "family": 20.98,
    "adult_band": 17.98,
    "under18_band": 2.98,
    "covers_addon": 5.98,
}

TIER_NAMES = {
    "listener": "Listener",
    "individual": "Individual Creator",
    "individual_covers": "Creator + Covers",
    "student": "Student Creator",
    "couple_duo": "Couple / Duo",
    "family": "Family",
    "adult_band": "Adult Band",
    "under18_band": "Under-18 Band",
    "covers_addon": "Covers Add-on",
}

# ── OWNERSHIP MODEL (AUD) ────────────────────────
# One-time $79.98 AUD OR finance with $9.99/mo × 12 months
OWNERSHIP_PRICES = {
    "ownership_full": 79.98,
    "ownership_finance": 9.99,
}
OWNERSHIP_NAMES = {
    "ownership_full": "Creator Ecosystem (One-time)",
    "ownership_finance": "Creator Ecosystem (Finance)",
}
OWNERSHIP_FINANCE_TOTAL_PAYMENTS = 12

# Tiers locked behind ownership (discounted tiers) — single source of truth in `platform.py`.
from routes.platform import LOCKED_TIERS


class CheckoutRequest(BaseModel):
    tier_key: str
    user_id: str
    origin_url: str


async def _activate_subscription(user_id: str, tier_key: str, session_id: str, now: str):
    """Activate a subscription record for a user."""
    tier_name = TIER_NAMES.get(tier_key, tier_key)
    price = TIER_PRICES.get(tier_key, 0)
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "user_id": user_id,
            "tier_key": tier_key,
            "tier_name": tier_name,
            "price": price,
            "status": "active",
            "trial_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "started_at": now,
            "payment_session_id": session_id,
            "last_upload": None,
            "active_band": tier_key in ("adult_band", "under18_band"),
            "reward_months": 0,
        }},
        upsert=True,
    )
    logger.info(f"Subscription activated: user={user_id} tier={tier_key}")


async def _credit_ownership(user_id: str, tier_key: str, amount: float, now: str):
    """Apply an ownership purchase: full unlock OR increment finance counter."""
    existing = await db.ownership.find_one({"user_id": user_id}, {"_id": 0})

    if tier_key == "ownership_full":
        # Immediate full ownership
        await db.ownership.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "status": "owned",
                "method": "one_time",
                "payments_made": 1,
                "payments_required": 1,
                "total_paid": float(amount),
                "currency": "aud",
                "started_at": (existing or {}).get("started_at", now),
                "completed_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )
        logger.info(f"Ownership full unlock: user={user_id} amount=AUD${amount}")
        return

    # Finance plan: $9.99 × 12
    if tier_key == "ownership_finance":
        prior_made = (existing or {}).get("payments_made", 0) if (existing and existing.get("method") == "finance") else 0
        prior_total = (existing or {}).get("total_paid", 0) if (existing and existing.get("method") == "finance") else 0
        if existing and existing.get("status") == "owned":
            # Already owned — no-op
            return
        new_made = prior_made + 1
        new_total = round(prior_total + float(amount), 2)
        new_status = "owned" if new_made >= OWNERSHIP_FINANCE_TOTAL_PAYMENTS else "financing"
        update_doc = {
            "user_id": user_id,
            "status": new_status,
            "method": "finance",
            "payments_made": new_made,
            "payments_required": OWNERSHIP_FINANCE_TOTAL_PAYMENTS,
            "total_paid": new_total,
            "currency": "aud",
            "started_at": (existing or {}).get("started_at", now),
            "updated_at": now,
        }
        if new_status == "owned":
            update_doc["completed_at"] = now
        await db.ownership.update_one({"user_id": user_id}, {"$set": update_doc}, upsert=True)
        logger.info(f"Ownership finance: user={user_id} payment={new_made}/{OWNERSHIP_FINANCE_TOTAL_PAYMENTS} status={new_status}")


@router.post("/payments/checkout")
async def create_checkout(payload: CheckoutRequest, request: Request):
    """Create a Stripe checkout session for a subscription tier OR ownership product."""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    is_ownership = payload.tier_key in OWNERSHIP_PRICES
    if not is_ownership and payload.tier_key not in TIER_PRICES:
        raise HTTPException(status_code=400, detail="Invalid tier key")

    # ── Discount gate: locked tiers require ownership ──
    if payload.tier_key in LOCKED_TIERS:
        own = await db.ownership.find_one({"user_id": payload.user_id}, {"_id": 0})
        if not own or own.get("status") != "owned":
            raise HTTPException(
                status_code=403,
                detail="This discounted tier requires Creator Ecosystem ownership. Purchase $79.98 AUD or complete the 12-month finance plan to unlock.",
            )

    amount = OWNERSHIP_PRICES[payload.tier_key] if is_ownership else TIER_PRICES[payload.tier_key]
    name = OWNERSHIP_NAMES[payload.tier_key] if is_ownership else TIER_NAMES.get(payload.tier_key, payload.tier_key)
    currency = "aud" if is_ownership else "usd"
    origin = payload.origin_url.rstrip("/")

    # Build URLs from frontend origin
    success_url = f"{origin}?payment=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}?payment=cancelled"

    # Init Stripe
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    # Create checkout session
    checkout_req = CheckoutSessionRequest(
        amount=float(amount),
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tier_key": payload.tier_key,
            "tier_name": name,
            "user_id": payload.user_id,
            "price": str(amount),
            "is_ownership": "true" if is_ownership else "false",
        },
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_req)

    # Create payment transaction record BEFORE redirect
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": payload.user_id,
        "tier_key": payload.tier_key,
        "tier_name": name,
        "amount": amount,
        "currency": currency,
        "is_ownership": is_ownership,
        "payment_status": "pending",
        "status": "initiated",
        "metadata": {"tier_key": payload.tier_key, "user_id": payload.user_id, "is_ownership": is_ownership},
        "created_at": now,
        "updated_at": now,
    })

    logger.info(f"Checkout created: session={session.session_id} user={payload.user_id} tier={payload.tier_key} amount={amount} {currency.upper()}")
    return {"success": True, "url": session.url, "session_id": session.session_id}


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Poll Stripe for checkout session status and update DB."""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    # Check if already processed to prevent double-crediting
    txn = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if txn and txn.get("payment_status") == "paid":
        return {"success": True, "status": "complete", "payment_status": "paid",
            "tier_key": txn.get("tier_key"), "already_processed": True}

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        checkout_status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.warning(f"Stripe status check failed: {e}")
        # Check our local DB for the transaction status
        if txn:
            return {"success": True, "status": txn.get("status", "unknown"), "payment_status": txn.get("payment_status", "unknown"),
                "tier_key": txn.get("tier_key"), "message": "Unable to verify with Stripe — showing last known status"}
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc).isoformat()

    if checkout_status.payment_status == "paid":
        # Update transaction
        await db.payment_transactions.update_one(
            {"session_id": session_id, "payment_status": {"$ne": "paid"}},
            {"$set": {"payment_status": "paid", "status": "complete", "updated_at": now}},
        )
        # Activate subscription or credit ownership
        meta = checkout_status.metadata or {}
        user_id = meta.get("user_id", txn.get("user_id", "") if txn else "")
        tier_key = meta.get("tier_key", txn.get("tier_key", "") if txn else "")
        is_ownership_meta = meta.get("is_ownership", "false") == "true" or tier_key in OWNERSHIP_PRICES
        if user_id and tier_key:
            if is_ownership_meta:
                amount = OWNERSHIP_PRICES.get(tier_key, txn.get("amount", 0) if txn else 0)
                await _credit_ownership(user_id, tier_key, float(amount), now)
            else:
                await _activate_subscription(user_id, tier_key, session_id, now)

        return {"success": True, "status": "complete", "payment_status": "paid", "tier_key": tier_key, "is_ownership": is_ownership_meta}

    elif checkout_status.status == "expired":
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "expired", "status": "expired", "updated_at": now}},
        )
        return {"success": True, "status": "expired", "payment_status": "expired"}

    return {"success": True, "status": checkout_status.status, "payment_status": checkout_status.payment_status}


@router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")

    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        event = await stripe_checkout.handle_webhook(body, signature)
        logger.info(f"Webhook event: type={event.event_type} session={event.session_id} status={event.payment_status}")

        now = datetime.now(timezone.utc).isoformat()

        if event.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"session_id": event.session_id, "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "paid", "status": "complete", "updated_at": now}},
            )
            # Activate subscription or credit ownership from webhook metadata
            meta = event.metadata or {}
            user_id = meta.get("user_id", "")
            tier_key = meta.get("tier_key", "")
            is_ownership_meta = meta.get("is_ownership", "false") == "true" or tier_key in OWNERSHIP_PRICES
            if user_id and tier_key:
                if is_ownership_meta:
                    amount = OWNERSHIP_PRICES.get(tier_key, 0)
                    await _credit_ownership(user_id, tier_key, float(amount), now)
                else:
                    await _activate_subscription(user_id, tier_key, event.session_id, now)
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}


# ── OWNERSHIP ENDPOINTS ──────────────────────────

@router.get("/ownership/products")
async def list_ownership_products():
    """Return the two Creator Ecosystem ownership products (AUD)."""
    return {
        "success": True,
        "currency": "aud",
        "messaging": "Unlock the Creator Ecosystem",
        "products": [
            {
                "key": "ownership_full",
                "name": OWNERSHIP_NAMES["ownership_full"],
                "tagline": "Pay once, unlock forever",
                "price": OWNERSHIP_PRICES["ownership_full"],
                "currency": "aud",
                "type": "one_time",
                "headline": "Unlock the Creator Ecosystem",
                "benefits": [
                    "Lifetime access to all discounted tiers",
                    "Student, Adult Band, U-18 Band, Family & Couple/Duo unlocked",
                    "70/30 artist-favoured revenue split on sales",
                    "Priority placement in Battles & Vibe-Match",
                ],
            },
            {
                "key": "ownership_finance",
                "name": OWNERSHIP_NAMES["ownership_finance"],
                "tagline": "Subscribe to Own — 12 months",
                "price": OWNERSHIP_PRICES["ownership_finance"],
                "currency": "aud",
                "type": "finance",
                "total_payments": OWNERSHIP_FINANCE_TOTAL_PAYMENTS,
                "total_value": round(OWNERSHIP_PRICES["ownership_finance"] * OWNERSHIP_FINANCE_TOTAL_PAYMENTS, 2),
                "headline": "Subscribe to Own",
                "benefits": [
                    f"${OWNERSHIP_PRICES['ownership_finance']} AUD/month for {OWNERSHIP_FINANCE_TOTAL_PAYMENTS} months",
                    "Unlocks discounted tiers progressively",
                    "Full ownership credited on final payment",
                    "Cancel anytime, keep months paid",
                ],
            },
        ],
        "locked_tiers": sorted(LOCKED_TIERS),
    }


@router.get("/ownership/{user_id}/status")
async def get_ownership_status(user_id: str):
    """Get a user's Creator Ecosystem ownership state."""
    own = await db.ownership.find_one({"user_id": user_id}, {"_id": 0})
    if not own:
        return {
            "success": True,
            "status": "none",
            "is_owned": False,
            "method": None,
            "payments_made": 0,
            "payments_required": OWNERSHIP_FINANCE_TOTAL_PAYMENTS,
            "payments_remaining": OWNERSHIP_FINANCE_TOTAL_PAYMENTS,
            "progress_pct": 0,
            "total_paid": 0,
            "currency": "aud",
            "locked_tiers": sorted(LOCKED_TIERS),
        }
    payments_made = own.get("payments_made", 0)
    payments_required = own.get("payments_required", OWNERSHIP_FINANCE_TOTAL_PAYMENTS)
    is_owned = own.get("status") == "owned"
    progress = 100 if is_owned else round((payments_made / max(1, payments_required)) * 100)
    return {
        "success": True,
        "status": own.get("status", "none"),
        "is_owned": is_owned,
        "method": own.get("method"),
        "payments_made": payments_made,
        "payments_required": payments_required,
        "payments_remaining": max(0, payments_required - payments_made),
        "progress_pct": progress,
        "total_paid": own.get("total_paid", 0),
        "currency": own.get("currency", "aud"),
        "started_at": own.get("started_at"),
        "completed_at": own.get("completed_at"),
        "locked_tiers": sorted(LOCKED_TIERS),
    }


class SimulatePayload(BaseModel):
    user_id: str
    tier_key: str


@router.post("/ownership/simulate")
async def simulate_ownership_payment(payload: SimulatePayload):
    """DEV/TEST helper: credit a Creator Ecosystem payment without going through Stripe.
    Used for testing the financing progression and gate behaviour.
    """
    if payload.tier_key not in OWNERSHIP_PRICES:
        raise HTTPException(status_code=400, detail="Invalid ownership product")
    now = datetime.now(timezone.utc).isoformat()
    await _credit_ownership(payload.user_id, payload.tier_key, OWNERSHIP_PRICES[payload.tier_key], now)
    return await get_ownership_status(payload.user_id)
