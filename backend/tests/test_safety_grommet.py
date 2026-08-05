"""Tests for Grommet Safety, AI grading, and Peer Ratings (iteration 36)."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _uid(prefix="TEST"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


# ── AGE MODE ─────────────────────────────────
class TestAgeMode:
    def test_set_and_get_adult(self):
        u = _uid("adult")
        r = requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "adult"})
        assert r.status_code == 200
        assert r.json()["mode"] == "adult"

        g = requests.get(f"{API}/safety/age-mode/{u}")
        assert g.status_code == 200
        d = g.json()
        assert d["mode"] == "adult" and d["is_grommet"] is False and d["graduated"] is False

    def test_set_and_get_grommet(self):
        u = _uid("grom")
        r = requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "grommet"})
        assert r.status_code == 200
        g = requests.get(f"{API}/safety/age-mode/{u}").json()
        assert g["mode"] == "grommet" and g["is_grommet"] is True

    def test_invalid_mode_400(self):
        r = requests.post(f"{API}/safety/age-mode", json={"user_id": _uid(), "mode": "child"})
        assert r.status_code == 400


# ── BATTLE REGISTER GUARD ───────────────────
class TestBattleGrommetGuard:
    def test_grommet_403_on_register(self):
        u = _uid("gbattle")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "grommet"})
        r = requests.post(f"{API}/rap-battles/register", json={"user_id": u, "display_name": "GromKid"})
        assert r.status_code == 403
        body = r.json()
        text = str(body).lower()
        assert "guardian" in text or "creator" in text

    def test_adult_can_register(self):
        u = _uid("abattle")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "adult"})
        r = requests.post(f"{API}/rap-battles/register", json={"user_id": u, "display_name": "AdultRapper"})
        # Register may return 200 with queued/matched or various success codes
        assert r.status_code in (200, 201), f"Unexpected: {r.status_code} {r.text}"


# ── GRADUATION FLOW ─────────────────────────
class TestGraduation:
    def test_wrong_then_right_pin(self):
        u = _uid("grad")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "grommet"})
        rq = requests.post(f"{API}/safety/graduation/request", json={"user_id": u, "guardian_name": "Mom"})
        assert rq.status_code == 200
        code = rq.json()["guardian_code"]
        assert len(code) == 4 and code.isdigit()

        # Wrong PIN → 403 and attempts increment
        wrong = "0000" if code != "0000" else "1111"
        w = requests.post(f"{API}/safety/graduation/approve", json={"user_id": u, "code": wrong})
        assert w.status_code == 403

        # Right PIN → success
        ok = requests.post(f"{API}/safety/graduation/approve", json={"user_id": u, "code": code})
        assert ok.status_code == 200
        d = ok.json()
        assert d["graduated"] is True and d["mode"] == "adult"

        # Age-mode now adult
        g = requests.get(f"{API}/safety/age-mode/{u}").json()
        assert g["is_grommet"] is False and g["graduated"] is True

        # Battle register now works
        rb = requests.post(f"{API}/rap-battles/register", json={"user_id": u, "display_name": "Graduated"})
        assert rb.status_code in (200, 201)

    def test_max_5_attempts_429(self):
        u = _uid("grad429")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "grommet"})
        rq = requests.post(f"{API}/safety/graduation/request", json={"user_id": u})
        code = rq.json()["guardian_code"]
        wrong = "0000" if code != "0000" else "1111"
        statuses = []
        for _ in range(6):
            r = requests.post(f"{API}/safety/graduation/approve", json={"user_id": u, "code": wrong})
            statuses.append(r.status_code)
        # After 5 attempts, subsequent calls should return 429
        assert 429 in statuses, f"Expected 429 in {statuses}"


# ── AI GRADING ──────────────────────────────
class TestAIGrade:
    def test_grade_math_and_letter(self):
        u = _uid("grade")
        # pitch 92 timing 80 → 92*.6+80*.4 = 87.2 → A
        r = requests.post(f"{API}/gamer/grade", json={
            "user_id": u, "context": "learn", "song_title": "C Major",
            "pitch_accuracy": 92, "timing_accuracy": 80,
        })
        assert r.status_code == 200
        d = r.json()
        assert abs(d["score"] - 87.2) < 0.05
        assert d["grade"] == "A"

    def test_grade_boundaries(self):
        u = _uid("gradeb")
        cases = [(100, 100, "S"), (90, 78, "A"), (80, 60, "B"), (60, 50, "C"), (30, 20, "D")]
        for p, t, letter in cases:
            r = requests.post(f"{API}/gamer/grade",
                              json={"user_id": u, "pitch_accuracy": p, "timing_accuracy": t})
            assert r.status_code == 200
            assert r.json()["grade"] == letter, f"{p}/{t} → expected {letter} got {r.json()}"

    def test_out_of_range_422(self):
        r = requests.post(f"{API}/gamer/grade",
                          json={"user_id": _uid(), "pitch_accuracy": 120, "timing_accuracy": 80})
        assert r.status_code == 422

    def test_grade_history(self):
        u = _uid("gradeh")
        requests.post(f"{API}/gamer/grade", json={"user_id": u, "pitch_accuracy": 80, "timing_accuracy": 80})
        h = requests.get(f"{API}/gamer/grades/{u}")
        assert h.status_code == 200
        assert len(h.json()["grades"]) >= 1


# ── PEER RATINGS ────────────────────────────
class TestRatings:
    def test_grommet_blocked_403(self):
        u = _uid("grate")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "grommet"})
        r = requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": "battle_x", "stars": 5})
        assert r.status_code == 403

    def test_stars_range_422(self):
        u = _uid("rrange")
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "adult"})
        r0 = requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": "battle_x", "stars": 0})
        r6 = requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": "battle_x", "stars": 6})
        assert r0.status_code == 422
        assert r6.status_code == 422

    def test_upsert_no_duplicate(self):
        u = _uid("rup")
        item = f"item_{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "adult"})
        r1 = requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": item, "stars": 3})
        assert r1.status_code == 200
        assert r1.json()["count"] == 1 and r1.json()["avg"] == 3 and r1.json()["my_stars"] == 3
        # Re-rate — should update not duplicate
        r2 = requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": item, "stars": 5})
        assert r2.status_code == 200
        assert r2.json()["count"] == 1
        assert r2.json()["avg"] == 5
        assert r2.json()["my_stars"] == 5

    def test_get_item_rating(self):
        u = _uid("rget")
        item = f"item_{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/safety/age-mode", json={"user_id": u, "mode": "adult"})
        requests.post(f"{API}/ratings", json={"rater_id": u, "item_id": item, "stars": 4})
        r = requests.get(f"{API}/ratings/{item}", params={"rater_id": u})
        assert r.status_code == 200
        d = r.json()
        assert d["avg"] == 4 and d["count"] == 1 and d["my_stars"] == 4

    def test_top_rated_sorted(self):
        # Seed a couple items with different avgs
        a = _uid("t1"); b = _uid("t2")
        requests.post(f"{API}/safety/age-mode", json={"user_id": a, "mode": "adult"})
        requests.post(f"{API}/safety/age-mode", json={"user_id": b, "mode": "adult"})
        item_high = f"battle_hi_{uuid.uuid4().hex[:6]}"
        item_low = f"battle_lo_{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/ratings", json={"rater_id": a, "item_id": item_high, "stars": 5})
        requests.post(f"{API}/ratings", json={"rater_id": b, "item_id": item_high, "stars": 5})
        requests.post(f"{API}/ratings", json={"rater_id": a, "item_id": item_low, "stars": 2})
        top = requests.get(f"{API}/ratings/top", params={"item_type": "battle"})
        assert top.status_code == 200
        rows = top.json()["top"]
        # Ensure sorted desc by avg
        avgs = [r["avg"] for r in rows]
        assert avgs == sorted(avgs, reverse=True)
