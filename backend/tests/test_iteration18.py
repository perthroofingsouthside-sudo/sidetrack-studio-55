"""Iteration 18 — SIDETRACK Band Auto-Downgrade Cron + Audit Logging.

Focus: validate the enhanced /api/subscriptions/check-band-activity that runs
the same core logic as the Sunday-midnight cron, plus the new audit endpoints
/api/subscriptions/band-audit and /api/subscriptions/band-audit/summary.

Business rules under test:
  • Inactive band sub (no upload in last 7 days) → downgraded to price 11.98
    with previous_tier, previous_price, downgrade_reason='No upload in 7 days'
  • Active band sub (uploaded in last 7 days) → stays compliant, price unchanged
  • Already-downgraded users excluded from subsequent runs (idempotent)
  • Each per-user audit entry has run_id, trigger, user_id, tier_key,
    original_price, last_upload, uploads_in_window, cutoff, met_requirement,
    action, new_price, checked_at
  • /band-audit/summary returns documents with type='run_summary'
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ── Regression: tiers, select, status ──────────────────────────────
class TestRegressionSubscriptions:
    def test_tiers_returns_seven(self, session):
        r = session.get(f"{API}/subscriptions/tiers")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert len(data["tiers"]) == 7
        keys = {t["key"] for t in data["tiers"]}
        assert {"adult_band", "under18_band", "individual"}.issubset(keys)
        # Verify adult_band still priced at 17.98, under18 at 2.98, individual at 11.98
        prices = {t["key"]: t["price"] for t in data["tiers"]}
        assert prices["adult_band"] == 17.98
        assert prices["under18_band"] == 2.98
        assert prices["individual"] == 11.98

    def test_select_subscription(self, session):
        uid = f"TEST_iter18_select_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/subscriptions/select",
                         json={"user_id": uid, "tier_key": "individual"})
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert data["subscription"]["tier_key"] == "individual"
        assert data["subscription"]["price"] == 11.98

    def test_status_endpoint(self, session):
        uid = f"TEST_iter18_status_{uuid.uuid4().hex[:6]}"
        session.post(f"{API}/subscriptions/select",
                     json={"user_id": uid, "tier_key": "adult_band"})
        r = session.get(f"{API}/subscriptions/{uid}/status")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert data["is_band"]
        assert data["tier_key"] == "adult_band"
        assert data["upload_status"] is not None
        assert data["upload_status"]["required"] == 1


# ── Core feature: Auto-downgrade with audit log ────────────────────
class TestBandAutoDowngrade:
    @pytest.fixture(scope="class")
    def users(self, session):
        """Seed: one ACTIVE band user (uploads), one INACTIVE band user (no uploads)."""
        active_uid = f"TEST_iter18_active_band_{uuid.uuid4().hex[:6]}"
        inactive_uid = f"TEST_iter18_inactive_band_{uuid.uuid4().hex[:6]}"
        under18_inactive_uid = f"TEST_iter18_u18_inactive_{uuid.uuid4().hex[:6]}"

        # Active band: subscribe + upload
        r = session.post(f"{API}/subscriptions/select",
                         json={"user_id": active_uid, "tier_key": "adult_band"})
        assert r.status_code == 200
        r2 = session.post(f"{API}/subscriptions/{active_uid}/upload")
        assert r2.status_code == 200

        # Inactive adult band: subscribe only
        r = session.post(f"{API}/subscriptions/select",
                         json={"user_id": inactive_uid, "tier_key": "adult_band"})
        assert r.status_code == 200

        # Inactive under-18 band: subscribe only
        r = session.post(f"{API}/subscriptions/select",
                         json={"user_id": under18_inactive_uid, "tier_key": "under18_band"})
        assert r.status_code == 200

        return {
            "active": active_uid,
            "inactive": inactive_uid,
            "u18_inactive": under18_inactive_uid,
        }

    def test_check_band_activity_runs_and_returns_counts(self, session, users):
        r = session.post(f"{API}/subscriptions/check-band-activity")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        # Required summary keys
        for key in ("run_id", "trigger", "checked_at", "total_checked",
                    "compliant_count", "downgraded_count", "downgraded_users",
                    "compliant_users"):
            assert key in data, f"Missing key {key} in response"
        assert data["trigger"] == "manual_api"
        assert isinstance(data["total_checked"], int)
        # Active user should be in compliant list, inactive + u18_inactive in downgraded list
        assert users["active"] in data["compliant_users"]
        assert users["inactive"] in data["downgraded_users"]
        assert users["u18_inactive"] in data["downgraded_users"]
        # Persist run_id for later assertions
        TestBandAutoDowngrade._run_id = data["run_id"]

    def test_inactive_band_user_was_downgraded(self, session, users):
        sub = session.get(f"{API}/subscriptions/{users['inactive']}/status").json()["subscription"]
        assert sub is not None
        assert sub["status"] == "downgraded"
        assert sub["price"] == 11.98
        assert sub["previous_tier"] == "adult_band"
        assert sub["previous_price"] == 17.98
        assert sub["downgrade_reason"] == "No upload in 7 days"
        assert sub.get("downgraded_at") is not None
        # tier_key remains the original for traceability (adult_band) — only status flips
        # (the implementation does not change tier_key, only price + status)

    def test_inactive_under18_band_user_was_downgraded(self, session, users):
        sub = session.get(f"{API}/subscriptions/{users['u18_inactive']}/status").json()["subscription"]
        assert sub["status"] == "downgraded"
        assert sub["price"] == 11.98
        assert sub["previous_tier"] == "under18_band"
        assert sub["previous_price"] == 2.98
        assert sub["downgrade_reason"] == "No upload in 7 days"

    def test_active_band_user_stays_compliant(self, session, users):
        sub = session.get(f"{API}/subscriptions/{users['active']}/status").json()["subscription"]
        assert sub["status"] != "downgraded"
        assert sub["price"] == 17.98  # Unchanged
        assert sub.get("previous_tier") is None
        assert sub.get("downgrade_reason") is None

    def test_idempotent_already_downgraded_excluded(self, session, users):
        """Re-running the check should NOT re-process the already-downgraded users."""
        r = session.post(f"{API}/subscriptions/check-band-activity")
        assert r.status_code == 200
        data = r.json()
        # Inactive users should not appear again
        assert users["inactive"] not in data["downgraded_users"]
        assert users["inactive"] not in data["compliant_users"]
        assert users["u18_inactive"] not in data["downgraded_users"]
        # Active user should still be re-checked and remain compliant
        assert users["active"] in data["compliant_users"]


# ── Audit log endpoints ────────────────────────────────────────────
class TestBandAuditEndpoints:
    def test_band_audit_returns_per_user_entries(self, session):
        r = session.get(f"{API}/subscriptions/band-audit?limit=200")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert "entries" in data and "count" in data
        assert isinstance(data["entries"], list)
        assert data["count"] >= 1

        # Find at least one per-user (non-summary) entry and validate all required fields
        per_user = [e for e in data["entries"] if e.get("type") != "run_summary"
                    and "user_id" in e]
        assert len(per_user) > 0, "No per-user audit entries found"

        sample = per_user[0]
        required_fields = ["run_id", "trigger", "user_id", "tier_key",
                           "original_price", "last_upload", "uploads_in_window",
                           "cutoff", "met_requirement", "action", "new_price",
                           "checked_at"]
        for f in required_fields:
            assert f in sample, f"Per-user audit entry missing field: {f}"

        # Validate action values are one of the expected
        actions = {e["action"] for e in per_user}
        assert actions.issubset({"compliant", "downgraded_to_individual", "none"})

        # At least one downgraded entry from our run should have new_price=11.98
        dg = [e for e in per_user if e["action"] == "downgraded_to_individual"]
        if dg:
            assert dg[0]["new_price"] == 11.98
            assert not dg[0]["met_requirement"]
            assert dg[0]["uploads_in_window"] == 0

    def test_band_audit_summary_returns_run_summaries(self, session):
        r = session.get(f"{API}/subscriptions/band-audit/summary?limit=20")
        assert r.status_code == 200
        data = r.json()
        assert data["success"]
        assert "summaries" in data and "count" in data
        assert data["count"] >= 1

        summary = data["summaries"][0]
        for f in ("run_id", "trigger", "checked_at", "total_checked",
                  "compliant_count", "downgraded_count"):
            assert f in summary, f"Run summary missing field: {f}"
        assert summary.get("type") == "run_summary"
        # trigger should reflect either manual_api or scheduled_cron_sunday
        assert summary["trigger"] in ("manual_api", "scheduled_cron_sunday")
