"""Iteration 21 — Two-Lane (Creator vs Gamer) ecosystem backend tests.

Covers:
- /api/lanes/set + /api/lanes/{user_id}
- /api/catalog/status, /api/catalog/in/{track_id}, /api/catalog/seed
- /api/backstage/motivation (Emergent LLM Claude Sonnet 4.5)
- /api/gamer/recordings (POST + GET)
- /api/spectator/hub
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


@pytest.fixture(scope="module")
def user_id():
    return f"TEST_iter21_{uuid.uuid4().hex[:8]}"


# ─── Lanes ─────────────────────────────────────
class TestLanes:
    def test_set_lane_gamer(self, session, user_id):
        r = session.post(f"{API}/lanes/set", json={"user_id": user_id, "lane": "gamer"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["lane"] == "gamer"

    def test_get_lane_returns_gamer(self, session, user_id):
        r = session.get(f"{API}/lanes/{user_id}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["lane"] == "gamer"

    def test_set_lane_creator_then_get(self, session, user_id):
        r = session.post(f"{API}/lanes/set", json={"user_id": user_id, "lane": "creator"})
        assert r.status_code == 200
        assert r.json()["lane"] == "creator"
        r2 = session.get(f"{API}/lanes/{user_id}")
        assert r2.json()["lane"] == "creator"

    def test_set_lane_invalid_returns_400(self, session, user_id):
        r = session.post(f"{API}/lanes/set", json={"user_id": user_id, "lane": "spectator"})
        assert r.status_code == 400

    def test_get_lane_unknown_user_defaults_to_creator(self, session):
        r = session.get(f"{API}/lanes/TEST_iter21_unknown_{uuid.uuid4().hex[:6]}")
        assert r.status_code == 200
        assert r.json()["lane"] == "creator"


# ─── Catalog ────────────────────────────────────
class TestCatalog:
    def test_catalog_status(self, session):
        r = session.get(f"{API}/catalog/status")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["curated_size_target"] == 3000
        assert "gate_strategy" in data
        assert isinstance(data["seeded_records"], int)

    def test_catalog_in_track_returns_flags(self, session):
        r = session.get(f"{API}/catalog/in/some_random_track_123")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert "in_catalog" in data
        assert "requires_ownership" in data
        assert isinstance(data["in_catalog"], bool)
        # requires_ownership is logical NOT of in_catalog
        assert data["requires_ownership"] == (not data["in_catalog"])

    def test_catalog_seed_inserts_expected_total(self, session):
        r = session.post(f"{API}/catalog/seed")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        # 800 MTV + 600 MOS + 800 HH + 600 AR = 2800 ops
        assert data.get("seeded", 0) == 2800
        assert data.get("target") == 3000

    def test_catalog_status_after_seed(self, session):
        r = session.get(f"{API}/catalog/status")
        data = r.json()
        # After seed, seeded_records should be >= 2800
        assert data["seeded_records"] >= 2800

    def test_catalog_in_seeded_track_is_true(self, session):
        r = session.get(f"{API}/catalog/in/mtv_seed_0001")
        data = r.json()
        assert data["in_catalog"] is True
        assert data["requires_ownership"] is False


# ─── Backstage AI motivation ─────────────────────
class TestBackstage:
    def test_motivation_returns_3_lines(self, session, user_id):
        r = session.post(f"{API}/backstage/motivation", json={
            "user_id": user_id,
            "song_title": "Smells Like Teen Spirit",
            "artist": "Nirvana",
            "style": "rock_legend",
        }, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert data["style"] == "rock_legend"
        assert isinstance(data["lines"], list)
        assert len(data["lines"]) == 3
        for line in data["lines"]:
            assert "id" in line and "text" in line and "is_ai" in line
            assert isinstance(line["text"], str) and len(line["text"]) > 5
            assert isinstance(line["is_ai"], bool)

    def test_motivation_styles(self, session, user_id):
        for style in ["hiphop_pioneer", "mtv_icon", "mos_dj"]:
            r = session.post(f"{API}/backstage/motivation", json={
                "user_id": user_id,
                "song_title": "Song",
                "artist": "Artist",
                "style": style,
            }, timeout=90)
            assert r.status_code == 200, f"style={style} body={r.text}"
            data = r.json()
            assert data["style"] == style
            assert len(data["lines"]) == 3

    def test_motivation_invalid_style_falls_back_to_rock_legend(self, session, user_id):
        r = session.post(f"{API}/backstage/motivation", json={
            "user_id": user_id,
            "song_title": "Song",
            "style": "not_a_real_style",
        }, timeout=90)
        assert r.status_code == 200
        assert r.json()["style"] == "rock_legend"


# ─── Gamer private recordings ───────────────────
class TestGamerRecordings:
    def test_create_recording(self, session, user_id):
        payload = {
            "user_id": user_id,
            "song_id": "TEST_song_iter21",
            "song_title": "TEST_Gamer_Song",
            "artist": "TEST_Artist",
            "duration_sec": 42.5,
            "blob_url": "blob:test-fake",
        }
        r = session.post(f"{API}/gamer/recordings", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        rec = data["recording"]
        assert rec["lane"] == "gamer"
        assert rec["is_private"] is True
        assert rec["share_to_social"] is False
        assert rec["song_title"] == "TEST_Gamer_Song"
        assert rec["user_id"] == user_id
        assert "id" in rec

    def test_list_recordings_for_user(self, session, user_id):
        r = session.get(f"{API}/gamer/recordings/{user_id}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert isinstance(data["recordings"], list)
        assert len(data["recordings"]) >= 1
        assert any(rec["song_title"] == "TEST_Gamer_Song" for rec in data["recordings"])
        # Ensure no mongo _id leaks
        for rec in data["recordings"]:
            assert "_id" not in rec


# ─── Spectator hub ──────────────────────────────
class TestSpectatorHub:
    def test_hub_returns_reality_and_gamer_arrays(self, session):
        r = session.get(f"{API}/spectator/hub")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["success"] is True
        assert isinstance(data["reality_sets"], list)
        assert isinstance(data["gamer_sets"], list)
        assert "reality_count" in data and "gamer_count" in data

    def test_hub_gamer_sets_do_not_leak_blob_url(self, session):
        r = session.get(f"{API}/spectator/hub")
        data = r.json()
        for g in data["gamer_sets"]:
            assert "blob_url" not in g, f"blob_url leaked in spectator hub: {g}"
            assert "performer_handle" in g
            assert g.get("is_virtual") is True
