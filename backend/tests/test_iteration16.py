"""
Iteration 16 Backend Tests - SIDETRACK Final Product features:
- /api/sync/clock and /api/sync/room
- /api/chat/{room}/history
- /api/social/follow, /api/social/{user_id}/stats, /api/social/{perf_id}/like
- /api/rewards/credit-winner
- /api/discover/for-you
- /api/lyrics/fetch (LRCLIB direct)
"""
import os
import io
import uuid
import pytest
import requests
from pathlib import Path


def _load_frontend_env():
    env_file = Path("/app/frontend/.env")
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_frontend_env()
BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL must be set"
API = f"{BASE}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


# --- Sync ---
class TestSync:
    def test_sync_clock(self, session):
        r = session.get(f"{API}/sync/clock", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        assert "server_time" in data
        assert "epoch_ms" in data
        assert isinstance(data["epoch_ms"], int)
        assert data["epoch_ms"] > 1_700_000_000_000  # after 2023

    def test_sync_room_create(self, session):
        r = session.post(
            f"{API}/sync/room",
            data={"room_name": "TEST_jamroom", "host_id": "TEST_host_user"},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        room = data["room"]
        assert room["name"] == "TEST_jamroom"
        assert room["host_id"] == "TEST_host_user"
        assert room["bpm"] == 120
        assert "id" in room


# --- Chat history ---
class TestChat:
    def test_chat_history_lobby(self, session):
        r = session.get(f"{API}/chat/lobby/history?limit=20", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        assert isinstance(data["messages"], list)
        assert "viewers" in data
        assert isinstance(data["viewers"], int)


# --- Social: stats / follow / like ---
class TestSocial:
    user_a = f"TEST_user_{uuid.uuid4().hex[:6]}"
    user_b = f"TEST_user_{uuid.uuid4().hex[:6]}"

    def test_stats_empty_user(self, session):
        r = session.get(f"{API}/social/{self.user_a}/stats", timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        stats = data["stats"]
        for key in ["battles", "stars", "playlists", "recordings",
                    "followers", "following", "total_votes"]:
            assert key in stats
            assert isinstance(stats[key], int)

    def test_follow_toggle(self, session):
        # Follow
        r1 = session.post(
            f"{API}/social/follow",
            json={"follower_id": self.user_a, "following_id": self.user_b},
            timeout=10,
        )
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["success"] == True
        assert d1["action"] == "followed"

        # Verify followers count via stats
        r_stats = session.get(f"{API}/social/{self.user_b}/stats", timeout=10)
        assert r_stats.json()["stats"]["followers"] >= 1

        # Unfollow (toggle)
        r2 = session.post(
            f"{API}/social/follow",
            json={"follower_id": self.user_a, "following_id": self.user_b},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["action"] == "unfollowed"

    def test_follow_self_rejected(self, session):
        r = session.post(
            f"{API}/social/follow",
            json={"follower_id": self.user_a, "following_id": self.user_a},
            timeout=10,
        )
        assert r.status_code == 400

    def test_like_toggle(self, session):
        perf_id = f"TEST_perf_{uuid.uuid4().hex[:6]}"
        uid = f"TEST_liker_{uuid.uuid4().hex[:6]}"
        r1 = session.post(
            f"{API}/social/{perf_id}/like",
            data={"user_id": uid},
            timeout=10,
        )
        assert r1.status_code == 200
        assert r1.json()["action"] == "liked"
        r2 = session.post(
            f"{API}/social/{perf_id}/like",
            data={"user_id": uid},
            timeout=10,
        )
        assert r2.status_code == 200
        assert r2.json()["action"] == "unliked"


# --- Rewards: credit-winner ---
class TestRewards:
    def test_credit_winner_no_battle(self, session):
        # Non-existent battle should return success=False (no qualifying winner)
        r = session.post(
            f"{API}/rewards/credit-winner",
            data={"battle_id": f"TEST_no_battle_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == False

    def test_credit_winner_full_flow(self, session):
        # Create a battle
        r_battle = session.post(
            f"{API}/battles",
            json={
                "song_id": f"TEST_song_{uuid.uuid4().hex[:6]}",
                "song_title": "TEST Song",
                "song_artist": "TEST Artist",
                "duration_hours": 24,
            },
            timeout=10,
        )
        assert r_battle.status_code == 200, r_battle.text
        battle = r_battle.json().get("battle") or r_battle.json()
        battle_id = battle["id"]

        # Submit a cover
        username = f"TEST_winner_{uuid.uuid4().hex[:6]}"
        files = {"file": ("a.wav", io.BytesIO(b"RIFFFAKEFAKE"), "audio/wav")}
        r_sub = session.post(
            f"{API}/battles/{battle_id}/submit",
            data={"username": username, "title": "TEST cover"},
            files=files,
            timeout=15,
        )
        assert r_sub.status_code == 200, r_sub.text
        cover_id = (r_sub.json().get("cover") or r_sub.json())["id"]

        # Vote for that cover
        r_vote = session.post(
            f"{API}/battles/{battle_id}/vote/{cover_id}",
            data={"voter_id": f"TEST_voter_{uuid.uuid4().hex[:6]}"},
            timeout=10,
        )
        assert r_vote.status_code == 200

        # Credit winner
        r_credit = session.post(
            f"{API}/rewards/credit-winner",
            data={"battle_id": battle_id},
            timeout=10,
        )
        assert r_credit.status_code == 200
        d = r_credit.json()
        assert d["success"] == True
        assert d["winner"] == username
        assert "1 month Pro" in d["reward"]

        # Verify subscription was created/updated
        r_status = session.get(f"{API}/subscriptions/{username}/status", timeout=10)
        assert r_status.status_code == 200


# --- Discover: For You ---
class TestDiscover:
    def test_for_you_empty_user(self, session):
        r = session.get(
            f"{API}/discover/for-you?user_id=TEST_unknown_{uuid.uuid4().hex[:6]}&limit=8",
            timeout=20,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] == True
        assert isinstance(data["tracks"], list)
        # Fallback should return at least some tracks (pop hits / trending)
        assert len(data["tracks"]) > 0
        first = data["tracks"][0]
        assert "title" in first
        assert "artist" in first
        assert "reason" in first
        assert first["reason"].startswith("Because you like ")


# --- Lyrics fetch (LRCLIB direct, used as PlayerStudio fallback) ---
class TestLyricsFetch:
    def test_lyrics_fetch_hello_adele(self, session):
        r = session.get(
            f"{API}/lyrics/fetch?track=Hello&artist=Adele",
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        # LRCLIB sometimes returns success even if no lyrics; assert structure
        assert "success" in data
        if data.get("success"):
            assert "lyrics" in data
            lyr = data["lyrics"]
            # lyr can be a list of synced lines OR a dict wrapper
            if isinstance(lyr, list):
                assert len(lyr) > 0
                assert "text" in lyr[0]
            else:
                assert "lines" in lyr or "plain" in lyr or "plainLyrics" in lyr
