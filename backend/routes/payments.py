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

# Fixed tier prices — NEVER accept amounts from frontend
TIER_PRICES = {
    "stadium_vip": 4.98,
    "individual": 11.98,
    "student": 9.98,
    "couple_duo": 14.98,
    "family": 20.98,
    "adult_band": 17.98,
    "under18_band": 2.98,
}

TIER_NAMES = {
    "stadium_vip": "Stadium VIP",
    "individual": "Individual",
    "student": "Student",
    "couple_duo": "Couple / Duo",
    "family": "Family",
    "adult_band": "Adult Band",
    "under18_band": "Under-18 Band",
}


class CheckoutRequest(BaseModel):
    tier_key: str
    user_id: str
    origin_url: str


@router.post("/payments/checkout")
async def create_checkout(payload: CheckoutRequest, request: Request):
    """Create a Stripe checkout session for a subscription tier."""
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")

    if payload.tier_key not in TIER_PRICES:
        raise HTTPException(status_code=400, detail="Invalid tier key")

    amount = TIER_PRICES[payload.tier_key]
    tier_name = TIER_NAMES.get(payload.tier_key, payload.tier_key)
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
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "tier_key": payload.tier_key,
            "tier_name": tier_name,
            "user_id": payload.user_id,
            "price": str(amount),
        },
    )
    session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_req)

    # Create payment transaction record BEFORE redirect
    now = datetime.now(timezone.utc).isoformat()
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "user_id": payload.user_id,
        "tier_key": payload.tier_key,
        "tier_name": tier_name,
        "amount": amount,
        "currency": "usd",
        "payment_status": "pending",
        "status": "initiated",
        "metadata": {"tier_key": payload.tier_key, "user_id": payload.user_id},
        "created_at": now,
        "updated_at": now,
    })

    logger.info(f"Checkout created: session={session.session_id} user={payload.user_id} tier={payload.tier_key} amount=${amount}")
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
        # Activate subscription
        meta = checkout_status.metadata or {}
        user_id = meta.get("user_id", txn.get("user_id", "") if txn else "")
        tier_key = meta.get("tier_key", txn.get("tier_key", "") if txn else "")
        if user_id and tier_key:
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

        return {"success": True, "status": "complete", "payment_status": "paid", "tier_key": tier_key}

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
            # Activate subscription from webhook metadata
            meta = event.metadata or {}
            user_id = meta.get("user_id", "")
            tier_key = meta.get("tier_key", "")
            if user_id and tier_key:
                tier_name = TIER_NAMES.get(tier_key, tier_key)
                price = TIER_PRICES.get(tier_key, 0)
                await db.subscriptions.update_one(
                    {"user_id": user_id},
                    {"$set": {
                        "user_id": user_id, "tier_key": tier_key, "tier_name": tier_name, "price": price,
                        "status": "active", "trial_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                        "started_at": now, "payment_session_id": event.session_id,
                        "last_upload": None, "active_band": tier_key in ("adult_band", "under18_band"), "reward_months": 0,
                    }},
                    upsert=True,
                )
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True, "error": str(e)}
