"""Regression tests for the 3 atomic concurrency fixes in routes/battles.py
(introduced Mar 1 2026 after the contest-launch code review).

Each test fires N concurrent requests against a single battle resource and
asserts the invariant that the atomic claim is supposed to guarantee.

Uses synchronous httpx + ThreadPoolExecutor so we don't need pytest-asyncio.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import httpx

BASE = os.environ.get("BACKEND_URL", "http://localhost:8001") + "/api"
TIMEOUT = 15.0


def _client() -> httpx.Client:
    return httpx.Client(timeout=TIMEOUT)


def _register(client: httpx.Client, uid: str) -> dict:
    r = client.post(f"{BASE}/rap-battles/register",
                    json={"user_id": uid, "display_name": uid})
    r.raise_for_status()
    return r.json()


def _agree(client: httpx.Client, battle_id: str, uid: str) -> dict:
    r = client.post(f"{BASE}/rap-battles/{battle_id}/agree", json={"user_id": uid})
    r.raise_for_status()
    return r.json()


def _setup_live_battle(client: httpx.Client) -> tuple[str, str, str]:
    """Create a fresh live battle between two synthetic users."""
    a = f"qa-a-{uuid.uuid4().hex[:8]}"
    b = f"qa-b-{uuid.uuid4().hex[:8]}"
    _register(client, a)
    r = _register(client, b)
    battle = r["battle"]
    bid = battle["id"]
    _agree(client, bid, a)
    _agree(client, bid, b)
    client.post(f"{BASE}/rap-battles/{bid}/go-live")
    return bid, a, b


def _post_vote(args):
    bid, voter, choice = args
    with _client() as c:
        return c.post(f"{BASE}/rap-battles/{bid}/vote",
                      json={"voter_id": voter, "choice": choice})


def _post_finish(bid):
    with _client() as c:
        return c.post(f"{BASE}/rap-battles/{bid}/finish")


def _post_matchmake():
    with _client() as c:
        return c.post(f"{BASE}/rap-battles/matchmake/run")


def _post_register(uid):
    with _client() as c:
        return c.post(f"{BASE}/rap-battles/register",
                      json={"user_id": uid, "display_name": uid})


def test_double_vote_is_blocked_atomically():
    """Firing N concurrent votes from one voter must record exactly ONE vote."""
    with _client() as client:
        bid, _a, _b = _setup_live_battle(client)
        voter = f"qa-voter-{uuid.uuid4().hex[:8]}"

        with ThreadPoolExecutor(max_workers=10) as pool:
            results = list(pool.map(_post_vote, [(bid, voter, "a")] * 10))

        ok = [r for r in results if r.status_code == 200]
        conflict = [r for r in results if r.status_code == 409]
        assert len(ok) == 1, f"expected exactly 1 vote accepted, got {len(ok)}"
        assert len(ok) + len(conflict) == 10

        b = client.get(f"{BASE}/rap-battles/{bid}").json()["battle"]
        assert b["votes_a"] == 1, f"votes_a should be 1, got {b['votes_a']}"


def test_finish_race_credits_winner_exactly_once():
    """Firing N concurrent /finish calls must increment lifetime_wins by exactly 1."""
    with _client() as client:
        bid, a, b = _setup_live_battle(client)
        # A few votes for side A so there's a clear winner
        for _ in range(3):
            v = f"v-{uuid.uuid4().hex[:6]}"
            client.post(f"{BASE}/rap-battles/{bid}/vote",
                        json={"voter_id": v, "choice": "a"})

        # Snapshot A's pre-finish wins
        me_a = client.get(f"{BASE}/rap-battles/me/{a}").json()
        wins_before = (me_a.get("user") or {}).get("lifetime_wins", 0)

        # 10 concurrent /finish calls (simulating every viewer's audio.onended)
        with ThreadPoolExecutor(max_workers=10) as pool:
            list(pool.map(_post_finish, [bid] * 10))

        me_a = client.get(f"{BASE}/rap-battles/me/{a}").json()
        wins_after = (me_a.get("user") or {}).get("lifetime_wins", 0)
        assert wins_after - wins_before == 1, (
            f"winner lifetime_wins inflation: before={wins_before} "
            f"after={wins_after} (must be exactly +1)"
        )

        me_b = client.get(f"{BASE}/rap-battles/me/{b}").json()
        loser_losses = (me_b.get("user") or {}).get("lifetime_losses", 0)
        assert loser_losses >= 1


def test_register_concurrent_does_not_duplicate_match():
    """Two near-simultaneous register/matchmake for the same pair must yield ≤1 match."""
    with _client() as client:
        a = f"qa-mm-a-{uuid.uuid4().hex[:8]}"
        b = f"qa-mm-b-{uuid.uuid4().hex[:8]}"
        # Seed `a` into the queue serially first
        _register(client, a)
        # Now fire register(b) AND matchmake/run in parallel — both try to pair (a,b).
        # The atomic claim must let only one succeed.
        with ThreadPoolExecutor(max_workers=2) as pool:
            f1 = pool.submit(_post_register, b)
            f2 = pool.submit(_post_matchmake)
            r1, r2 = f1.result(), f2.result()

        matches = []
        for r in (r1, r2):
            try:
                data = r.json()
            except Exception:
                continue
            if data.get("battle"):
                matches.append(data["battle"]["id"])

        # Either exactly one match was created, or both calls returned the
        # SAME battle id (one inserted, the other observed via _try_match).
        assert len(set(matches)) <= 1, (
            f"duplicate matches created for the same pair: {matches}"
        )
