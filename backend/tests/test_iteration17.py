"""Iteration 17 — SIDETRACK Final Production Push.

Covers:
- Refactor sanity (all routes still wired through /api on slim server.py)
- New: Music-theory chord engine /api/chords/lookup
- New: Active-Band auto-downgrade /api/subscriptions/check-band-activity
- New: Real audio trimming /api/trim (valid + invalid range)
- Regression: subscriptions/tiers, /select, /{user_id}/status, lyrics/fetch,
  music/search, music/top-songs, battles, stars/feed, social stats/follow,
  sync/clock, discover/for-you, chat lobby history.
"""
import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vocal-studio-55.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ── Refactor / health ───────────────────────────
class TestHealth:
    def test_health(self, s):
        r = s.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("status") in ("healthy", "ok") or d.get("ok") == True


# ── Music-theory chord engine ───────────────────
class TestChordEngine:
    def test_chords_lookup_pop_hello_adele(self, s):
        r = s.get(f"{API}/chords/lookup", params={"track": "Hello", "artist": "Adele", "genre": "pop", "duration": 120}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] == True
        assert "key" in d and isinstance(d["key"], str) and len(d["key"]) >= 1
        assert isinstance(d["chords"], list) and len(d["chords"]) > 0
        first = d["chords"][0]
        assert {"time", "chord", "duration"}.issubset(first.keys())
        # Pop default key should be C
        assert d["key"] == "C"

    def test_chords_lookup_rock_key_E(self, s):
        r = s.get(f"{API}/chords/lookup", params={"genre": "rock"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["key"] == "E"
        chords = [c["chord"] for c in d["chords"]]
        # Rock progression in E should contain at least one of E/A/B
        assert any(c in ("E", "A", "B", "C#m") for c in chords)

    def test_chords_lookup_jazz_key_F(self, s):
        r = s.get(f"{API}/chords/lookup", params={"genre": "jazz"}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["key"] == "F"


# ── Subscriptions ───────────────────────────────
class TestSubscriptions:
    def test_tiers_returns_seven(self, s):
        r = s.get(f"{API}/subscriptions/tiers", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d["success"] == True
        assert isinstance(d["tiers"], list)
        assert len(d["tiers"]) == 7, f"expected 7 tiers, got {len(d['tiers'])}"
        keys = {t["key"] for t in d["tiers"]}
        assert {"adult_band", "under18_band"}.issubset(keys)

    def test_select_and_status(self, s):
        uid = f"TEST_user_{uuid.uuid4().hex[:8]}"
        r = s.post(f"{API}/subscriptions/select", json={"user_id": uid, "tier_key": "adult_band"}, timeout=15)
        assert r.status_code == 200, r.text
        sub = r.json()["subscription"]
        assert sub["tier_key"] == "adult_band"
        assert sub["active_band"] == True

        r2 = s.get(f"{API}/subscriptions/{uid}/status", timeout=15)
        assert r2.status_code == 200
        d = r2.json()
        assert d["is_band"] == True
        assert d["tier_key"] == "adult_band"
        assert d["upload_status"] is not None and d["upload_status"]["required"] == 1

    def test_select_invalid_tier(self, s):
        r = s.post(f"{API}/subscriptions/select", json={"user_id": "TEST_x", "tier_key": "bogus"}, timeout=15)
        assert r.status_code == 400

    def test_check_band_activity_downgrade(self, s):
        # Create a band sub with no last_upload, then call the check endpoint.
        uid = f"TEST_band_{uuid.uuid4().hex[:8]}"
        s.post(f"{API}/subscriptions/select", json={"user_id": uid, "tier_key": "adult_band"}, timeout=15)
        r = s.post(f"{API}/subscriptions/check-band-activity", timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] == True
        assert isinstance(d["checked"], int) and d["checked"] >= 1
        assert isinstance(d["downgraded"], int)
        # The newly-created uid should be in the downgraded list
        assert uid in d["downgraded_users"]
        # And status should now reflect it
        r2 = s.get(f"{API}/subscriptions/{uid}/status", timeout=15)
        assert r2.json()["subscription"]["status"] == "downgraded"


# ── Real audio trimming ─────────────────────────
class TestTrim:
    def test_trim_valid_range_metadata_fallback(self, s):
        # No recording_id supplied -> metadata fallback path, still success.
        r = s.post(f"{API}/trim", json={"recording_id": "", "start_pct": 10, "end_pct": 80}, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["success"] == True
        assert d["start_pct"] == 10 and d["end_pct"] == 80

    def test_trim_invalid_range_400(self, s):
        r = s.post(f"{API}/trim", json={"recording_id": "x", "start_pct": 80, "end_pct": 20}, timeout=15)
        assert r.status_code == 400

    def test_trim_out_of_bounds_400(self, s):
        r = s.post(f"{API}/trim", json={"recording_id": "x", "start_pct": -1, "end_pct": 50}, timeout=15)
        assert r.status_code == 400


# ── Lyrics / chords integration ─────────────────
class TestLyrics:
    def test_lyrics_fetch_hello_adele(self, s):
        r = s.get(f"{API}/lyrics/fetch", params={"track": "Hello", "artist": "Adele"}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("success") == True
        # Synced lyrics + chord engine fields
        assert "lyrics" in d or "synced" in d or "lines" in d
        assert "key" in d
        assert "chords" in d and isinstance(d["chords"], list) and len(d["chords"]) > 0


# ── Music search / top songs ────────────────────
class TestMusic:
    def test_search(self, s):
        r = s.get(f"{API}/music/search", params={"q": "hello"}, timeout=30)
        assert r.status_code == 200
        d = r.json()
        tracks = d.get("tracks") or d.get("results") or []
        assert isinstance(tracks, list) and len(tracks) > 0

    def test_top_songs(self, s):
        r = s.get(f"{API}/music/top-songs", timeout=30)
        assert r.status_code == 200
        d = r.json()
        tracks = d.get("tracks") or d.get("results") or []
        assert isinstance(tracks, list) and len(tracks) > 0


# ── Community / battles / stars ─────────────────
class TestCommunity:
    def test_create_battle(self, s):
        payload = {
            "title": f"TEST_Battle_{uuid.uuid4().hex[:6]}",
            "song_id": "test-song",
            "song_title": "Test Song",
            "creator_username": "TEST_user",
        }
        r = s.post(f"{API}/battles", json=payload, timeout=20)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert "id" in d or "battle_id" in d or (isinstance(d.get("battle"), dict) and "id" in d["battle"])

    def test_stars_feed(self, s):
        r = s.get(f"{API}/stars/feed", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "feed" in d or "stars" in d or "performances" in d or isinstance(d, list)


# ── Social / sync / discover / chat ─────────────
class TestPlatform:
    def test_social_stats(self, s):
        r = s.get(f"{API}/social/TEST_user_static/stats", timeout=15)
        assert r.status_code == 200
        d = r.json()
        stats = d.get("stats", d)
        for k in ("followers", "following"):
            assert k in stats

    def test_social_follow_toggle(self, s):
        a = f"TEST_a_{uuid.uuid4().hex[:6]}"
        b = f"TEST_b_{uuid.uuid4().hex[:6]}"
        body = {"follower_id": a, "following_id": b}
        r1 = s.post(f"{API}/social/follow", json=body, timeout=15)
        assert r1.status_code == 200, r1.text
        d1 = r1.json()
        assert "following" in d1 or "is_following" in d1 or d1.get("success") == True
        r2 = s.post(f"{API}/social/follow", json=body, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        # Toggle should produce a different state on the boolean it returns
        for k in ("following", "is_following"):
            if k in d1 and k in d2:
                assert d1[k] != d2[k]
                break

    def test_sync_clock(self, s):
        r = s.get(f"{API}/sync/clock", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "server_time" in d and "epoch_ms" in d
        assert isinstance(d["epoch_ms"], int)

    def test_discover_for_you(self, s):
        r = s.get(f"{API}/discover/for-you", timeout=30)
        assert r.status_code == 200
        d = r.json()
        recs = d.get("tracks") or d.get("recommendations") or d.get("for_you") or []
        assert isinstance(recs, list)

    def test_chat_lobby_history(self, s):
        r = s.get(f"{API}/chat/lobby/history", timeout=15)
        assert r.status_code == 200
        d = r.json()
        msgs = d.get("messages") if isinstance(d, dict) else d
        assert isinstance(msgs, list)


# ── Cleanup hook ────────────────────────────────
@pytest.fixture(scope="module", autouse=True)
def _final_cleanup():
    yield
    # Best-effort: nothing critical, TEST_-prefixed docs are harmless.
    return
