"""Tests for iteration 15: Trim API + Band upload tracker + Subscription status."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://vocal-studio-55.preview.emergentagent.com').rstrip('/')


@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Subscription tiers regression ---
class TestSubscriptionTiers:
    def test_list_tiers_returns_seven(self, client):
        r = client.get(f"{BASE_URL}/api/subscriptions/tiers")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert len(data["tiers"]) == 7
        keys = {t["key"] for t in data["tiers"]}
        assert {"stadium_vip", "individual", "student", "couple_duo", "family", "adult_band", "under18_band"} <= keys


# --- Trim API ---
class TestTrimAPI:
    def test_trim_valid(self, client):
        r = client.post(f"{BASE_URL}/api/trim", json={"recording_id": "rec_test", "start_pct": 10, "end_pct": 80})
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert data["start_pct"] == 10
        assert data["end_pct"] == 80
        assert data["recording_id"] == "rec_test"

    def test_trim_invalid_range_start_ge_end(self, client):
        r = client.post(f"{BASE_URL}/api/trim", json={"recording_id": "rec", "start_pct": 80, "end_pct": 80})
        assert r.status_code == 400

    def test_trim_invalid_range_negative(self, client):
        r = client.post(f"{BASE_URL}/api/trim", json={"recording_id": "rec", "start_pct": -5, "end_pct": 50})
        assert r.status_code == 400

    def test_trim_invalid_range_over_100(self, client):
        r = client.post(f"{BASE_URL}/api/trim", json={"recording_id": "rec", "start_pct": 5, "end_pct": 150})
        assert r.status_code == 400


# --- Band upload tracker + Subscription status ---
class TestBandUploadTracker:
    def test_band_subscribe_and_record_upload(self, client):
        user_id = f"TEST_band_{uuid.uuid4().hex[:8]}"
        # Subscribe to adult_band
        r = client.post(f"{BASE_URL}/api/subscriptions/select", json={"user_id": user_id, "tier_key": "adult_band"})
        assert r.status_code == 200
        sub = r.json()["subscription"]
        assert sub["tier_key"] == "adult_band"
        assert sub["active_band"]

        # Status with upload_status before any upload
        r = client.get(f"{BASE_URL}/api/subscriptions/{user_id}/status")
        assert r.status_code == 200
        s = r.json()
        assert s["is_band"]
        assert s["is_pro"]
        assert s["upload_status"] is not None
        us = s["upload_status"]
        assert us["uploads_this_week"] == 0
        assert us["required"] == 1
        assert not us["met"]
        assert "week_start" in us and "week_end" in us

        # Record one upload
        r = client.post(f"{BASE_URL}/api/subscriptions/{user_id}/upload")
        assert r.status_code == 200
        assert r.json()["success"]

        # Status now should show met=True
        r = client.get(f"{BASE_URL}/api/subscriptions/{user_id}/status")
        assert r.status_code == 200
        us2 = r.json()["upload_status"]
        assert us2["uploads_this_week"] >= 1
        assert us2["met"]

    def test_non_band_upload_rejected(self, client):
        user_id = f"TEST_solo_{uuid.uuid4().hex[:8]}"
        client.post(f"{BASE_URL}/api/subscriptions/select", json={"user_id": user_id, "tier_key": "individual"})
        r = client.post(f"{BASE_URL}/api/subscriptions/{user_id}/upload")
        assert r.status_code == 400

    def test_no_subscription_upload_rejected(self, client):
        user_id = f"TEST_nosub_{uuid.uuid4().hex[:8]}"
        r = client.post(f"{BASE_URL}/api/subscriptions/{user_id}/upload")
        assert r.status_code == 400

    def test_non_band_status_has_null_upload_status(self, client):
        user_id = f"TEST_ind_{uuid.uuid4().hex[:8]}"
        client.post(f"{BASE_URL}/api/subscriptions/select", json={"user_id": user_id, "tier_key": "individual"})
        r = client.get(f"{BASE_URL}/api/subscriptions/{user_id}/status")
        assert r.status_code == 200
        s = r.json()
        assert not s["is_band"]
        assert s["is_pro"]
        assert s["upload_status"] is None

    def test_no_subscription_status(self, client):
        user_id = f"TEST_none_{uuid.uuid4().hex[:8]}"
        r = client.get(f"{BASE_URL}/api/subscriptions/{user_id}/status")
        assert r.status_code == 200
        s = r.json()
        assert not s["is_pro"]
        assert s["tier_key"] == "free"
        # Note: upload_status key is not present in no-subscription response (minor inconsistency)
        assert s.get("upload_status") is None
