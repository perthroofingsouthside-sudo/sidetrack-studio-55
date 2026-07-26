"""FREE ACCESS MODEL — Pocket Products is 100% free.

All Stripe checkout / subscription / ownership-purchase code was removed in
the free pivot. Legacy endpoints remain as universal-access stubs so any
older client immediately sees everything unlocked.
"""
from fastapi import APIRouter
import logging

logger = logging.getLogger(__name__)
router = APIRouter()

FREE_MESSAGE = "Pocket Products is completely free — no purchase required."


@router.get("/ownership/products")
async def list_ownership_products():
    return {"success": True, "free": True, "products": [], "messaging": FREE_MESSAGE, "locked_tiers": []}


@router.get("/ownership/{user_id}/status")
async def get_ownership_status(user_id: str):
    """Everyone owns everything — universal free access."""
    return {
        "success": True,
        "status": "owned",
        "is_owned": True,
        "method": "free",
        "payments_made": 0,
        "payments_required": 0,
        "payments_remaining": 0,
        "progress_pct": 100,
        "total_paid": 0,
        "currency": "aud",
        "locked_tiers": [],
        "message": FREE_MESSAGE,
    }


@router.post("/payments/checkout")
async def create_checkout():
    """Legacy stub — there is nothing to buy anymore."""
    return {"success": False, "free": True, "message": FREE_MESSAGE}


@router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str):
    """Legacy stub for old return-from-checkout polls."""
    return {"success": True, "status": "free", "payment_status": "free", "message": FREE_MESSAGE}
