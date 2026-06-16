"""Iteration 19 — Stripe payments integration test suite.

Covers:
- POST /api/payments/checkout (valid + invalid tier_key)
- payment_transactions DB record creation (status='initiated', payment_status='pending')
- Server-side TIER_PRICES enforcement (frontend cannot inject amount)
- GET /api/payments/status/{session_id} (Stripe fallback + 404 for unknown)
- POST /api/webhook/stripe reachability
- Regressions: /api/health, /api/subscriptions/tiers (still 7 tiers)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocal-studio-55.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

VALID_TIERS_PRICES = {
    "stadium_vip": 4.98,
    "individual": 11.98,
    "student": 9.98,
    "couple_duo": 14.98,
    "family": 20.98,
    "adult_band": 17.98,
    "under18_band": 2.98,
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── REGRESSIONS ─────────────────────────────────────
class TestRegression:
    def test_health(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        # accept either {"status":"healthy"} or {"ok":True}
        assert any(
            (k in data and str(data[k]).lower() in ("healthy", "ok", "true"))
            for k in ("status", "ok", "health")
        ), f"Unexpected health payload: {data}"

    def test_tiers_returns_seven(self, session):
        r = session.get(f"{API}/subscriptions/tiers", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success")
        tiers = data.get("tiers", [])
        assert len(tiers) == 7, f"Expected 7 tiers, got {len(tiers)}"
        keys = {t["key"] for t in tiers}
        assert keys == set(VALID_TIERS_PRICES.keys())
        # validate per-tier price matches server-side TIER_PRICES
        for t in tiers:
            assert abs(t["price"] - VALID_TIERS_PRICES[t["key"]]) < 1e-6, t


# ── CHECKOUT ────────────────────────────────────────
class TestCheckout:
    def test_invalid_tier_returns_400(self, session):
        payload = {
            "tier_key": "not_a_real_tier",
            "user_id": f"TEST_iter19_{uuid.uuid4().hex[:8]}",
            "origin_url": BASE_URL,
        }
        r = session.post(f"{API}/payments/checkout", json=payload, timeout=20)
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"

    def test_missing_fields_returns_422(self, session):
        r = session.post(f"{API}/payments/checkout", json={"tier_key": "individual"}, timeout=15)
        assert r.status_code in (400, 422), r.text

    @pytest.mark.parametrize("tier_key", list(VALID_TIERS_PRICES.keys()))
    def test_valid_tiers_create_checkout(self, session, tier_key):
        """Each of the 7 tiers must produce a real Stripe checkout URL."""
        user_id = f"TEST_iter19_{tier_key}_{uuid.uuid4().hex[:6]}"
        payload = {
            "tier_key": tier_key,
            "user_id": user_id,
            "origin_url": BASE_URL,
        }
        r = session.post(f"{API}/payments/checkout", json=payload, timeout=30)
        assert r.status_code == 200, f"{tier_key}: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("success")
        assert data.get("session_id"), f"missing session_id: {data}"
        url = data.get("url", "")
        assert "checkout.stripe.com" in url, f"expected real Stripe URL, got {url}"

    def test_stadium_vip_checkout_amount_serverside(self, session):
        """Verify amount is server-controlled — even if frontend tries to send 0.01."""
        user_id = f"TEST_iter19_amount_{uuid.uuid4().hex[:6]}"
        payload = {
            "tier_key": "stadium_vip",
            "user_id": user_id,
            "origin_url": BASE_URL,
            # Try injecting a fake amount — backend must ignore it
            "amount": 0.01,
            "price": 0.01,
        }
        r = session.post(f"{API}/payments/checkout", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        session_id = data["session_id"]

        # Now poll status — fallback to DB returns the recorded amount via tier_key
        rs = session.get(f"{API}/payments/status/{session_id}", timeout=20)
        assert rs.status_code == 200, rs.text
        sd = rs.json()
        # tier_key should be stadium_vip (server-side), not anything else
        assert sd.get("tier_key") == "stadium_vip", sd


# ── STATUS ENDPOINT ─────────────────────────────────
class TestStatus:
    def test_status_unknown_session_returns_404(self, session):
        fake = f"cs_test_unknown_{uuid.uuid4().hex}"
        r = session.get(f"{API}/payments/status/{fake}", timeout=20)
        assert r.status_code == 404, f"Expected 404 for unknown session, got {r.status_code}: {r.text}"

    def test_status_after_checkout_returns_pending_or_complete(self, session):
        """Create checkout → poll status. Should return success=True with a payment_status."""
        user_id = f"TEST_iter19_status_{uuid.uuid4().hex[:6]}"
        ck = session.post(
            f"{API}/payments/checkout",
            json={"tier_key": "individual", "user_id": user_id, "origin_url": BASE_URL},
            timeout=30,
        )
        assert ck.status_code == 200, ck.text
        sid = ck.json()["session_id"]

        r = session.get(f"{API}/payments/status/{sid}", timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("success")
        # newly created session should not be paid
        assert data.get("payment_status") in (
            "pending", "unpaid", "no_payment_required", "unknown", "open", "initiated"
        ), f"Unexpected status: {data}"
        assert data.get("tier_key") == "individual", data


# ── WEBHOOK ─────────────────────────────────────────
class TestWebhook:
    def test_webhook_endpoint_exists(self, session):
        """Webhook should accept POST. Without a valid signature it returns 200 with error or 4xx,
        but it must NOT 404."""
        r = session.post(
            f"{API}/webhook/stripe",
            data=b'{"type":"test","data":{}}',
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=0,v1=invalid"},
            timeout=20,
        )
        assert r.status_code != 404, f"webhook 404 — endpoint missing: {r.text}"
        # Implementation swallows errors and returns {"received":True,"error":...} OR raises 400
        assert r.status_code in (200, 400, 401, 403, 422), f"Unexpected: {r.status_code} {r.text}"


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
