"""Backend tests for Subscription Tiers (Stadium VIP + Pro Plans)."""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocal-studio-55.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_TIERS = {
    "stadium_vip": {"name": "Stadium VIP", "price": 4.98, "category": "fan", "highlight": True},
    "individual": {"name": "Individual", "price": 11.98, "category": "creator", "highlight": False},
    "student": {"name": "Student", "price": 9.98, "category": "creator", "highlight": False},
    "couple_duo": {"name": "Couple / Duo", "price": 14.98, "category": "creator", "highlight": False},
    "family": {"name": "Family", "price": 20.98, "category": "creator", "highlight": False},
    "adult_band": {"name": "Adult Band", "price": 17.98, "category": "band", "highlight": False},
    "under18_band": {"name": "Under-18 Band", "price": 2.98, "category": "band", "highlight": False},
}

VIP_EXPECTED_FEATURES = [
    "Save & share personal mixes to profile",
    "Exclusive neon chat badges & emojis",
    "Priority DM access to artists during live sessions",
]


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def user_id():
    return f"TEST_{uuid.uuid4()}"


# ── GET /api/subscriptions/tiers ──────────────────
class TestListTiers:
    def test_list_returns_all_7_tiers(self, client):
        r = client.get(f"{API}/subscriptions/tiers", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        tiers = data["tiers"]
        assert isinstance(tiers, list)
        assert len(tiers) == 7, f"Expected 7 tiers, got {len(tiers)}"

    def test_each_tier_has_correct_price_and_category(self, client):
        r = client.get(f"{API}/subscriptions/tiers", timeout=10)
        tiers = {t["key"]: t for t in r.json()["tiers"]}
        for key, expected in EXPECTED_TIERS.items():
            assert key in tiers, f"Tier {key} missing"
            t = tiers[key]
            assert t["name"] == expected["name"]
            assert t["price"] == expected["price"]
            assert t["category"] == expected["category"]
            assert t["highlight"] == expected["highlight"]
            assert isinstance(t["features"], list)
            assert len(t["features"]) >= 3

    def test_stadium_vip_features_match(self, client):
        r = client.get(f"{API}/subscriptions/tiers", timeout=10)
        vip = next(t for t in r.json()["tiers"] if t["key"] == "stadium_vip")
        assert vip["features"] == VIP_EXPECTED_FEATURES


# ── POST /api/subscriptions/select ────────────────
class TestSelectSubscription:
    def test_select_valid_tier_creates_trial_subscription(self, client, user_id):
        r = client.post(
            f"{API}/subscriptions/select",
            json={"user_id": user_id, "tier_key": "stadium_vip"},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        sub = data["subscription"]
        assert sub["user_id"] == user_id
        assert sub["tier_key"] == "stadium_vip"
        assert sub["tier_name"] == "Stadium VIP"
        assert sub["price"] == 4.98
        assert sub["status"] == "trial"
        assert "trial_end" in sub and sub["trial_end"]
        # trial_end should be ~30 days out
        trial_end = datetime.fromisoformat(sub["trial_end"].replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta_days = (trial_end - now).days
        assert 28 <= delta_days <= 30, f"trial_end ~30 days expected, got {delta_days}"

    def test_select_invalid_tier_returns_400(self, client, user_id):
        r = client.post(
            f"{API}/subscriptions/select",
            json={"user_id": user_id, "tier_key": "nonexistent_tier"},
            timeout=10,
        )
        assert r.status_code == 400
        assert "detail" in r.json()

    def test_select_persists_and_is_readable(self, client, user_id):
        # Create
        sel = client.post(
            f"{API}/subscriptions/select",
            json={"user_id": user_id, "tier_key": "individual"},
            timeout=10,
        )
        assert sel.status_code == 200
        # Verify via GET status
        st = client.get(f"{API}/subscriptions/{user_id}/status", timeout=10)
        assert st.status_code == 200
        sd = st.json()
        assert sd["tier_key"] == "individual"
        assert sd["is_pro"] == True
        assert sd["is_vip"] == False

    def test_select_upserts_existing_subscription(self, client, user_id):
        client.post(f"{API}/subscriptions/select", json={"user_id": user_id, "tier_key": "student"}, timeout=10)
        r = client.post(f"{API}/subscriptions/select", json={"user_id": user_id, "tier_key": "family"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["subscription"]["tier_key"] == "family"


# ── GET /api/subscriptions/{user_id}/status ────────
class TestSubscriptionStatus:
    def test_status_for_non_subscribed_user(self, client):
        unique_id = f"TEST_NONSUB_{uuid.uuid4()}"
        r = client.get(f"{API}/subscriptions/{unique_id}/status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] == True
        assert d["is_pro"] == False
        assert d["is_vip"] == False
        assert d["tier_key"] == "free"
        assert d["subscription"] is None

    def test_status_for_vip_user(self, client, user_id):
        client.post(f"{API}/subscriptions/select", json={"user_id": user_id, "tier_key": "stadium_vip"}, timeout=10)
        r = client.get(f"{API}/subscriptions/{user_id}/status", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["is_pro"] == True
        assert d["is_vip"] == True
        assert d["tier_key"] == "stadium_vip"

    def test_status_for_creator_tier_is_pro_not_vip(self, client, user_id):
        client.post(f"{API}/subscriptions/select", json={"user_id": user_id, "tier_key": "individual"}, timeout=10)
        r = client.get(f"{API}/subscriptions/{user_id}/status", timeout=10)
        d = r.json()
        assert d["is_pro"] == True
        assert d["is_vip"] == False
        assert d["tier_key"] == "individual"

    def test_no_mongodb_objectid_in_response(self, client, user_id):
        client.post(f"{API}/subscriptions/select", json={"user_id": user_id, "tier_key": "adult_band"}, timeout=10)
        r = client.get(f"{API}/subscriptions/{user_id}/status", timeout=10)
        sub = r.json()["subscription"]
        assert "_id" not in sub, "MongoDB _id leaking in response"
