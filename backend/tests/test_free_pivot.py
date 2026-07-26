"""Tests for the Free Pivot business change.
Covers: subscriptions stubs, ownership stubs, payments stubs, catalog free-gate,
store 70/30 split retained, rewards badge-only, and removed band endpoints.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── Subscriptions ──
class TestSubscriptions:
    def test_tiers_free(self, s):
        r = s.get(f"{API}/subscriptions/tiers")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("tiers") == []
        assert d.get("all_free") is True
        assert d.get("is_owned") is True

    def test_status_any_user(self, s):
        for uid in [str(uuid.uuid4()), "random-legacy-id", "abc123"]:
            r = s.get(f"{API}/subscriptions/{uid}/status")
            assert r.status_code == 200
            d = r.json()
            assert d["is_pro"] is True
            assert d["is_vip"] is True
            assert d["all_free"] is True
            assert d["subscription"] is None

    def test_select_returns_success(self, s):
        r = s.post(f"{API}/subscriptions/select",
                   json={"user_id": str(uuid.uuid4()), "tier_key": "any"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["all_free"] is True
        assert d["subscription"] is None


# ── Ownership ──
class TestOwnership:
    def test_status_any_user(self, s):
        for uid in [str(uuid.uuid4()), "another-fake-id"]:
            r = s.get(f"{API}/ownership/{uid}/status")
            assert r.status_code == 200
            d = r.json()
            assert d["is_owned"] is True
            assert d["status"] == "owned"
            assert d["progress_pct"] == 100
            assert d["locked_tiers"] == []

    def test_products_free(self, s):
        r = s.get(f"{API}/ownership/products")
        assert r.status_code == 200
        d = r.json()
        assert d["free"] is True
        assert d["products"] == []


# ── Payments ──
class TestPayments:
    def test_checkout_free_stub(self, s):
        r = s.post(f"{API}/payments/checkout", json={})
        assert r.status_code == 200
        d = r.json()
        assert d["free"] is True
        assert d["success"] is False

    def test_status_free_stub(self, s):
        r = s.get(f"{API}/payments/status/anything-here")
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "free"


# ── Catalog (free gate) ──
class TestCatalog:
    def test_status_no_gate(self, s):
        r = s.get(f"{API}/catalog/status")
        assert r.status_code == 200
        d = r.json()
        assert d["non_curated_requires_ownership"] is False

    def test_random_tracks_no_gate(self, s):
        for _ in range(6):
            tid = str(uuid.uuid4())
            r = s.get(f"{API}/catalog/in/{tid}")
            assert r.status_code == 200
            d = r.json()
            assert d["requires_ownership"] is False


# ── Store: 70/30 split RETAINED ──
class TestStore:
    def test_pricing(self, s):
        r = s.get(f"{API}/store/pricing")
        assert r.status_code == 200
        d = r.json()
        assert d["artist_cut_pct"] == 70
        assert d["platform_cut_pct"] == 30
        assert d["price_per_song"] == 0.79

    def test_purchase_split(self, s):
        payload = {
            "user_id": f"TEST_{uuid.uuid4()}",
            "track_id": f"TEST_track_{uuid.uuid4()}",
            "title": "TEST Song",
            "artist": "TEST Artist",
        }
        r = s.post(f"{API}/store/purchase", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] is True
        assert d["price"] == 0.79
        assert d["artist_share"] == 0.55
        assert d["platform_share"] == 0.24

    def test_purchase_idempotent(self, s):
        uid = f"TEST_{uuid.uuid4()}"
        tid = f"TEST_track_{uuid.uuid4()}"
        payload = {"user_id": uid, "track_id": tid, "title": "T", "artist": "A"}
        r1 = s.post(f"{API}/store/purchase", json=payload)
        assert r1.status_code == 200
        r2 = s.post(f"{API}/store/purchase", json=payload)
        assert r2.status_code == 200
        assert r2.json().get("already_owned") is True


# ── Rewards ──
class TestRewards:
    def test_credit_winner_no_battle(self, s):
        # Form-encoded, unknown battle id → "No qualifying winner"
        r = requests.post(f"{API}/rewards/credit-winner",
                          data={"battle_id": f"nonexistent-{uuid.uuid4()}"})
        assert r.status_code == 200
        d = r.json()
        assert d["success"] is False
        assert "No qualifying winner" in d["message"]


# ── Removed Band endpoints → 404 ──
class TestRemovedBand:
    def test_check_band_activity_404(self, s):
        r = s.post(f"{API}/subscriptions/check-band-activity", json={})
        assert r.status_code == 404

    def test_band_audit_404(self, s):
        r = s.get(f"{API}/subscriptions/band-audit")
        assert r.status_code == 404

    def test_band_upload_404(self, s):
        r = s.post(f"{API}/subscriptions/some-user/upload", json={})
        assert r.status_code == 404
