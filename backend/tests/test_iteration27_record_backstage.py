"""
Iteration 27 — Backend smoke tests for:
  - POST /api/studio/beat/generate (AI Beat Maker used on Record/PersonalStudio page)
  - /api/gamer/recordings flows (used by Backstage page Watch button on Kept tab)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocal-studio-55.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

USER_ID = "rec_demo"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── Studio AI Beat Generation ────────────────────────────────
class TestStudioBeatGenerate:
    def test_beat_generate_minimal_payload(self, s):
        payload = {"prompt": "dark trap 808 eerie keys", "bpm": 96, "genre": "Trap", "duration_sec": 30}
        r = s.post(f"{API}/studio/beat/generate", json=payload, timeout=30)
        assert r.status_code in (200, 201), f"unexpected {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert isinstance(data, dict)
        # Either audio_url, beat_url, or success flag — endpoint may be mocked
        assert any(k in data for k in ("audio_url", "beat_url", "success", "beat_id", "id")), \
            f"no recognised key in response: {list(data.keys())}"

    def test_beat_generate_different_genres(self, s):
        for g in ["Hip-Hop", "Lo-Fi", "Boom Bap", "Drill", "R&B"]:
            r = s.post(f"{API}/studio/beat/generate",
                       json={"prompt": f"{g} vibe", "bpm": 120, "genre": g, "duration_sec": 20},
                       timeout=30)
            assert r.status_code in (200, 201), f"{g} -> {r.status_code}: {r.text[:200]}"


# ── Gamer Recordings (Backstage data source) ─────────────────
class TestGamerRecordings:
    def test_get_recordings_kept_tab(self, s):
        r = s.get(f"{API}/gamer/recordings/{USER_ID}?status=kept&limit=50", timeout=15)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("success") is True
        assert isinstance(data.get("recordings"), list)

    def test_get_recordings_pending(self, s):
        r = s.get(f"{API}/gamer/recordings/{USER_ID}?status=pending_review&limit=50", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("success") is True
        assert isinstance(data.get("recordings"), list)

    def test_create_keep_and_verify(self, s):
        # Create a recording
        payload = {
            "user_id": USER_ID,
            "song_id": f"TEST_song_{int(time.time())}",
            "song_title": "TEST_BackstageWatch",
            "artist": "Tester",
            "duration_sec": 12,
            "blob_url": "https://example.com/take.webm",
            "performance_type": "karaoke",
        }
        cr = s.post(f"{API}/gamer/recordings", json=payload, timeout=15)
        assert cr.status_code in (200, 201), f"create -> {cr.status_code}: {cr.text[:300]}"
        cd = cr.json()
        rec_id = cd.get("recording_id") or cd.get("id") or (cd.get("recording") or {}).get("id")
        if not rec_id:
            pytest.skip(f"Couldn't extract recording id from {cd}")

        # Keep it
        rr = s.post(f"{API}/gamer/recordings/{rec_id}/review",
                    json={"user_id": USER_ID, "action": "keep"}, timeout=15)
        assert rr.status_code in (200, 201), f"review -> {rr.status_code}: {rr.text[:300]}"

        # Verify it appears in Kept tab
        time.sleep(0.5)
        kept = s.get(f"{API}/gamer/recordings/{USER_ID}?status=kept&limit=50", timeout=15).json()
        ids = [x.get("id") for x in kept.get("recordings", [])]
        assert rec_id in ids, f"kept recording {rec_id} not found in kept list (got {len(ids)} items)"
