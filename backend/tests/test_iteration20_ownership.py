"""Iteration 20 — Ownership Model, Studio AI (Beat + Cleanup), Tier locking tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL must be set"

API = f"{BASE_URL}/api"


def _uid(prefix="TEST_iter20"):
    return f"{prefix}_{int(time.time() * 1000)}"


# ── Ownership Products ──────────────────────
class TestOwnershipProducts:
    def test_products_returns_two_aud_products(self):
        r = requests.get(f"{API}/ownership/products", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert data["currency"] == "aud"
        keys = {p["key"]: p for p in data["products"]}
        assert "ownership_full" in keys and "ownership_finance" in keys
        assert keys["ownership_full"]["price"] == 79.98
        assert keys["ownership_finance"]["price"] == 9.99
        assert keys["ownership_finance"]["total_payments"] == 12

    def test_status_new_user_is_none(self):
        uid = _uid("TEST_iter20_status")
        r = requests.get(f"{API}/ownership/{uid}/status", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "none"
        assert data["payments_made"] == 0
        assert data["is_owned"] is False


# ── Ownership Simulate ──────────────────────
class TestOwnershipSimulate:
    def test_simulate_full_marks_owned(self):
        uid = _uid("TEST_iter20_full")
        r = requests.post(f"{API}/ownership/simulate",
                          json={"user_id": uid, "tier_key": "ownership_full"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["is_owned"] is True
        assert data["status"] == "owned"

        # verify status endpoint also confirms
        r2 = requests.get(f"{API}/ownership/{uid}/status", timeout=10)
        assert r2.json()["is_owned"] is True

    def test_simulate_finance_12_times_progresses(self):
        uid = _uid("TEST_iter20_fin")
        last = None
        for i in range(1, 13):
            r = requests.post(f"{API}/ownership/simulate",
                              json={"user_id": uid, "tier_key": "ownership_finance"}, timeout=10)
            assert r.status_code == 200
            last = r.json()
            assert last["payments_made"] == i
            if i < 12:
                assert last["status"] == "financing"
                assert last["is_owned"] is False
            else:
                assert last["status"] == "owned"
                assert last["is_owned"] is True

    def test_simulate_invalid_tier_400(self):
        r = requests.post(f"{API}/ownership/simulate",
                          json={"user_id": "x", "tier_key": "bogus"}, timeout=10)
        assert r.status_code == 400


# ── Subscription Tier locking & gate ────────
class TestTierLocking:
    LOCKED = {"student", "couple_duo", "family", "adult_band", "under18_band"}

    def test_tiers_locked_for_non_owner(self):
        uid = _uid("TEST_iter20_lock")
        r = requests.get(f"{API}/subscriptions/tiers", params={"user_id": uid}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["is_owned"] is False
        by_key = {t["key"]: t for t in data["tiers"]}
        for k in self.LOCKED:
            assert by_key[k]["locked"] is True, f"{k} should be locked for non-owner"
        # listener + individual + addon NOT locked
        for k in ("listener", "individual", "individual_covers", "covers_addon"):
            assert by_key[k]["locked"] is False

    def test_tiers_unlocked_after_ownership(self):
        uid = _uid("TEST_iter20_unlock")
        requests.post(f"{API}/ownership/simulate",
                      json={"user_id": uid, "tier_key": "ownership_full"}, timeout=10)
        r = requests.get(f"{API}/subscriptions/tiers", params={"user_id": uid}, timeout=10)
        data = r.json()
        assert data["is_owned"] is True
        by_key = {t["key"]: t for t in data["tiers"]}
        for k in self.LOCKED:
            assert by_key[k]["locked"] is False

    def test_select_student_without_ownership_403(self):
        uid = _uid("TEST_iter20_select_blk")
        r = requests.post(f"{API}/subscriptions/select",
                          json={"user_id": uid, "tier_key": "student"}, timeout=10)
        assert r.status_code == 403
        assert "Creator Ecosystem" in r.json().get("detail", "")

    def test_select_student_after_ownership(self):
        uid = _uid("TEST_iter20_select_ok")
        requests.post(f"{API}/ownership/simulate",
                      json={"user_id": uid, "tier_key": "ownership_full"}, timeout=10)
        r = requests.post(f"{API}/subscriptions/select",
                          json={"user_id": uid, "tier_key": "student"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["subscription"]["tier_key"] == "student"


# ── Stripe checkout (with gate) ────────────
class TestCheckout:
    def test_checkout_ownership_full_aud(self):
        uid = _uid("TEST_iter20_co_full")
        r = requests.post(f"{API}/payments/checkout",
                          json={"tier_key": "ownership_full", "user_id": uid,
                                "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "checkout.stripe.com" in data["url"]

    def test_checkout_student_no_ownership_403(self):
        uid = _uid("TEST_iter20_co_blk")
        r = requests.post(f"{API}/payments/checkout",
                          json={"tier_key": "student", "user_id": uid,
                                "origin_url": "https://example.com"}, timeout=15)
        assert r.status_code == 403

    def test_checkout_listener_always_ok(self):
        uid = _uid("TEST_iter20_co_lst")
        r = requests.post(f"{API}/payments/checkout",
                          json={"tier_key": "listener", "user_id": uid,
                                "origin_url": "https://example.com"}, timeout=20)
        assert r.status_code == 200
        assert "checkout.stripe.com" in r.json()["url"]


# ── Studio AI: genres / beat / cleanup ─────
class TestStudioAI:
    def test_genres_whitelist(self):
        r = requests.get(f"{API}/studio/genres", timeout=10)
        assert r.status_code == 200
        keys = {g["key"] for g in r.json()["genres"]}
        assert keys == {"mtv_classic", "ministry_of_sound", "hip_hop_top200", "alt_rock"}

    def test_beat_generate_valid(self):
        uid = _uid("TEST_iter20_beat")
        r = requests.post(f"{API}/studio/beat/generate",
                          json={"genre": "alt_rock", "bpm": 110, "bars": 8,
                                "key": "C", "user_id": uid}, timeout=15)
        assert r.status_code == 200, r.text
        beat = r.json()["beat"]
        for stem in ("kick", "snare", "hihat", "bass"):
            assert stem in beat["pattern"]
            assert len(beat["pattern"][stem]) == 32  # 8 bars * 4
        assert beat["duration_sec"] > 0

    def test_beat_invalid_genre_400(self):
        r = requests.post(f"{API}/studio/beat/generate",
                          json={"genre": "polka", "bpm": 120, "bars": 8,
                                "key": "C", "user_id": "x"}, timeout=10)
        assert r.status_code == 400

    def test_cleanup_rock_live_applied(self):
        uid = _uid("TEST_iter20_clean")
        r = requests.post(f"{API}/studio/cleanup",
                          json={"user_id": uid, "mode": "rock", "live": True}, timeout=10)
        assert r.status_code == 200, r.text
        job = r.json()["job"]
        assert job["status"] == "applied"
        assert "noise_floor_db" in job["profile"]

    def test_cleanup_invalid_mode_400(self):
        r = requests.post(f"{API}/studio/cleanup",
                          json={"user_id": "x", "mode": "polka", "live": False}, timeout=10)
        assert r.status_code == 400
