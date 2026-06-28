"""Rap Battle Matchmaking, Live Voting, Archive & Quarterly Tournament.

Flow:
  1. POST /rap-battles/register             — user joins the matchmaking queue
  2. (auto)  matchmaker pairs waiting users into a `battle` doc
  3. POST /rap-battles/{id}/agree           — both users must agree
  4. POST /rap-battles/{id}/go-live         — first_mover decided, beat generated,
                                          status → "live"
  5. POST /rap-battles/{id}/vote            — viewers vote (1 per voter)
  6. POST /rap-battles/{id}/finish          — winner tallied, archived for 7 days
  7. GET  /rap-battles/archive              — list archived battles
  8. GET  /rap-battles/leaderboard          — Top 200 by lifetime wins
  9. GET  /rap-battles/tournament/current   — current quarterly tournament info
"""
from __future__ import annotations
import random
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db
from services.beat_synth import synthesize_beat_data_url

logger = logging.getLogger(__name__)
router = APIRouter()

ARCHIVE_TTL_DAYS = 7
BEAT_DURATION_SEC = 60


# ────────────────────────────────────────────────────────────────────────────
# Models
# ────────────────────────────────────────────────────────────────────────────

class RegisterReq(BaseModel):
    user_id: str
    display_name: str = ""


class AgreeReq(BaseModel):
    user_id: str


class VoteReq(BaseModel):
    voter_id: str
    choice: Literal["a", "b"]


# ────────────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.isoformat()


async def _get_or_create_user(user_id: str, display_name: str = "") -> dict:
    user = await db.battle_users.find_one({"user_id": user_id}, {"_id": 0})
    if user:
        if display_name and display_name != user.get("display_name"):
            await db.battle_users.update_one(
                {"user_id": user_id}, {"$set": {"display_name": display_name}}
            )
            user["display_name"] = display_name
        return user
    doc = {
        "user_id": user_id,
        "display_name": display_name or user_id,
        "lifetime_wins": 0,
        "lifetime_losses": 0,
        "in_queue": False,
        "created_at": _iso(_now()),
    }
    await db.battle_users.insert_one(doc)
    return doc


async def _public_profile(user_id: str) -> dict:
    u = await db.battle_users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        return {"user_id": user_id, "display_name": user_id, "lifetime_wins": 0, "lifetime_losses": 0}
    return {
        "user_id": u["user_id"],
        "display_name": u.get("display_name") or u["user_id"],
        "lifetime_wins": u.get("lifetime_wins", 0),
        "lifetime_losses": u.get("lifetime_losses", 0),
    }


async def _try_match() -> Optional[dict]:
    """Pair the two longest-waiting users in the queue, if at least two exist."""
    waiting = await db.battle_users.find(
        {"in_queue": True}, {"_id": 0}
    ).sort("queued_at", 1).limit(2).to_list(2)
    if len(waiting) < 2:
        return None
    a, b = waiting[0], waiting[1]

    battle = {
        "id": str(uuid.uuid4()),
        "user_a": a["user_id"],
        "user_b": b["user_id"],
        "profile_a": await _public_profile(a["user_id"]),
        "profile_b": await _public_profile(b["user_id"]),
        "status": "pending_agreement",  # pending_agreement → agreed → live → finished → archived
        "agreed_a": False,
        "agreed_b": False,
        "first_mover": None,            # "a" | "b"
        "coin_flip": False,
        "votes_a": 0,
        "votes_b": 0,
        "voters": [],                   # list of voter_id (1 vote per voter)
        "beat_data_url": None,
        "winner": None,
        "started_at": None,
        "ended_at": None,
        "archive_expires_at": None,
        "created_at": _iso(_now()),
    }
    await db.battles.insert_one(battle)
    # Remove both from queue
    await db.battle_users.update_many(
        {"user_id": {"$in": [a["user_id"], b["user_id"]]}},
        {"$set": {"in_queue": False, "matched_at": _iso(_now())}, "$unset": {"queued_at": ""}},
    )
    logger.info(f"[battles] matched {a['user_id']} vs {b['user_id']} → {battle['id']}")
    battle.pop("_id", None)
    return battle


def _quarter_window(now: Optional[datetime] = None) -> tuple[int, int, datetime, datetime]:
    """Return (quarter_number, year, quarter_start_utc, quarter_end_utc)."""
    now = now or _now()
    q = (now.month - 1) // 3 + 1
    start = datetime(now.year, (q - 1) * 3 + 1, 1, tzinfo=timezone.utc)
    end_month = q * 3 + 1
    end_year = now.year + (1 if end_month > 12 else 0)
    end_month = end_month if end_month <= 12 else 1
    end = datetime(end_year, end_month, 1, tzinfo=timezone.utc)
    return q, now.year, start, end


def _generate_60s_beat() -> str:
    """Render a ~60-second hip-hop pattern as data:audio/wav;base64,..."""
    # 16-step base pattern × 22 = 352 steps; at 88 BPM that's ≈60s.
    base = {
        "kick":  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        "snare": [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        "hihat": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        "bass":  [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    }
    reps = 22
    pattern = {k: v * reps for k, v in base.items()}
    return synthesize_beat_data_url(pattern, bpm=88, key="A")


# ────────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────────

@router.post("/rap-battles/register")
async def register(req: RegisterReq):
    """Register a user for the matchmaking queue. Auto-runs matchmaker."""
    if not req.user_id.strip():
        raise HTTPException(400, "user_id required")

    await _get_or_create_user(req.user_id, req.display_name)

    # Don't double-queue. If user is already in an active battle, refuse.
    active = await db.battles.find_one(
        {"$and": [
            {"$or": [{"user_a": req.user_id}, {"user_b": req.user_id}]},
            {"status": {"$in": ["pending_agreement", "agreed", "live"]}},
        ]},
        {"_id": 0},
    )
    if active:
        return {"success": True, "status": "in_match", "battle": active}

    await db.battle_users.update_one(
        {"user_id": req.user_id},
        {"$set": {"in_queue": True, "queued_at": _iso(_now())}},
    )
    # Try to pair immediately
    match = await _try_match()
    if match:
        return {"success": True, "status": "matched", "battle": match}
    return {"success": True, "status": "waiting"}


@router.post("/rap-battles/matchmake/run")
async def matchmake_run():
    """Idempotent pairing pass. Pairs only one battle per call."""
    match = await _try_match()
    return {"success": True, "matched": bool(match), "battle": match}


@router.get("/rap-battles/me/{user_id}")
async def me(user_id: str):
    """Snapshot used by the Connect tab to render Battle Hub state."""
    user = await db.battle_users.find_one({"user_id": user_id}, {"_id": 0})
    active = await db.battles.find_one(
        {"$and": [
            {"$or": [{"user_a": user_id}, {"user_b": user_id}]},
            {"status": {"$in": ["pending_agreement", "agreed", "live"]}},
        ]},
        {"_id": 0, "beat_data_url": 0},  # withhold heavy field by default
    )
    history = await db.battles.find(
        {"$and": [
            {"$or": [{"user_a": user_id}, {"user_b": user_id}]},
            {"status": {"$in": ["finished", "archived"]}},
        ]},
        {"_id": 0, "beat_data_url": 0, "voters": 0},
    ).sort("ended_at", -1).limit(20).to_list(20)
    return {
        "success": True,
        "user": user,
        "in_queue": bool(user and user.get("in_queue")),
        "active_battle": active,
        "history": history,
    }


@router.get("/rap-battles/archive")
async def archive(limit: int = 30):
    """List archived battles still within their 7-day viewing window."""
    cutoff = _iso(_now())
    items = await db.battles.find(
        {"status": "archived", "archive_expires_at": {"$gt": cutoff}},
        {"_id": 0, "beat_data_url": 0, "voters": 0},
    ).sort("ended_at", -1).limit(limit).to_list(limit)
    return {"success": True, "battles": items}


@router.get("/rap-battles/leaderboard")
async def leaderboard(limit: int = 200):
    """Top N rappers by lifetime wins (defaults to Top 200 for the quarterly contest)."""
    items = await db.battle_users.find(
        {}, {"_id": 0, "user_id": 1, "display_name": 1, "lifetime_wins": 1, "lifetime_losses": 1},
    ).sort([("lifetime_wins", -1), ("lifetime_losses", 1)]).limit(limit).to_list(limit)
    return {"success": True, "leaders": items}


@router.get("/rap-battles/tournament/current")
async def current_tournament():
    """Live snapshot of the quarterly Top 200 tournament window."""
    q, year, start, end = _quarter_window()
    lb = await leaderboard(200)
    return {
        "success": True,
        "tournament": {
            "quarter": q,
            "year": year,
            "starts_at": _iso(start),
            "ends_at": _iso(end),
            "qualifies_top": 200,
            "leaders": lb["leaders"],
        },
    }


@router.get("/rap-battles/{battle_id}")
async def get_battle(battle_id: str, include_beat: bool = False):
    proj = {"_id": 0}
    if not include_beat:
        proj["beat_data_url"] = 0
    b = await db.battles.find_one({"id": battle_id}, proj)
    if not b:
        raise HTTPException(404, "Battle not found")
    return {"success": True, "battle": b}


@router.post("/rap-battles/{battle_id}/agree")
async def agree(battle_id: str, req: AgreeReq):
    """Both users must agree. When both have agreed → first_mover decided + beat generated."""
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Battle not found")
    if b["status"] not in ("pending_agreement",):
        return {"success": True, "battle": b}

    if req.user_id == b["user_a"]:
        side = "a"
    elif req.user_id == b["user_b"]:
        side = "b"
    else:
        raise HTTPException(403, "Not a participant")

    update = {f"agreed_{side}": True}
    await db.battles.update_one({"id": battle_id}, {"$set": update})
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})

    if b["agreed_a"] and b["agreed_b"]:
        # Decide first mover by lifetime_wins. Tie → coin flip.
        wins_a = (b["profile_a"] or {}).get("lifetime_wins", 0)
        wins_b = (b["profile_b"] or {}).get("lifetime_wins", 0)
        coin = False
        if wins_a > wins_b:
            # Higher-ranked picks; default to themselves first (their choice).
            first = "a"
        elif wins_b > wins_a:
            first = "b"
        else:
            coin = True
            first = random.choice(["a", "b"])
        beat = _generate_60s_beat()
        await db.battles.update_one(
            {"id": battle_id},
            {"$set": {
                "status": "agreed",
                "first_mover": first,
                "coin_flip": coin,
                "beat_data_url": beat,
            }},
        )
        b = await db.battles.find_one({"id": battle_id}, {"_id": 0, "beat_data_url": 0})
    return {"success": True, "battle": b}


@router.post("/rap-battles/{battle_id}/go-live")
async def go_live(battle_id: str):
    """Transition agreed battle to live. Frontend polls votes from here."""
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Battle not found")
    if b["status"] not in ("agreed", "live"):
        raise HTTPException(409, f"Battle is {b['status']}")
    if b["status"] == "agreed":
        await db.battles.update_one(
            {"id": battle_id},
            {"$set": {"status": "live", "started_at": _iso(_now())}},
        )
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    return {"success": True, "battle": b}


@router.post("/rap-battles/{battle_id}/vote")
async def vote(battle_id: str, req: VoteReq):
    """1 vote per voter per battle. Allowed while live OR archived (within TTL)."""
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Battle not found")
    if b["status"] not in ("live", "finished", "archived"):
        raise HTTPException(409, f"Voting not open ({b['status']})")
    if b["status"] in ("finished", "archived"):
        expires = b.get("archive_expires_at")
        if expires and _now() > datetime.fromisoformat(expires):
            raise HTTPException(410, "Archive window closed")
    if req.voter_id in (b.get("voters") or []):
        raise HTTPException(409, "Already voted")
    if req.voter_id in (b["user_a"], b["user_b"]):
        raise HTTPException(403, "Participants cannot vote")
    inc = {"votes_a": 1} if req.choice == "a" else {"votes_b": 1}
    await db.battles.update_one(
        {"id": battle_id},
        {"$inc": inc, "$push": {"voters": req.voter_id}},
    )
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0, "beat_data_url": 0, "voters": 0})
    return {"success": True, "battle": b}


@router.post("/rap-battles/{battle_id}/finish")
async def finish(battle_id: str):
    """Mark battle done, archive for 7 days, increment winner/loser counters."""
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Battle not found")
    if b["status"] not in ("live", "agreed"):
        return {"success": True, "battle": b}

    winner_side = None
    if b["votes_a"] > b["votes_b"]:
        winner_side = "a"
    elif b["votes_b"] > b["votes_a"]:
        winner_side = "b"
    # Tie → no winner credited

    winner_id = b["user_a"] if winner_side == "a" else (b["user_b"] if winner_side == "b" else None)
    loser_id = b["user_b"] if winner_side == "a" else (b["user_a"] if winner_side == "b" else None)

    expires = _now() + timedelta(days=ARCHIVE_TTL_DAYS)
    await db.battles.update_one(
        {"id": battle_id},
        {"$set": {
            "status": "archived",
            "winner": winner_id,
            "ended_at": _iso(_now()),
            "archive_expires_at": _iso(expires),
        }},
    )
    if winner_id:
        await db.battle_users.update_one({"user_id": winner_id}, {"$inc": {"lifetime_wins": 1}})
    if loser_id:
        await db.battle_users.update_one({"user_id": loser_id}, {"$inc": {"lifetime_losses": 1}})
    b = await db.battles.find_one({"id": battle_id}, {"_id": 0, "beat_data_url": 0, "voters": 0})
    return {"success": True, "battle": b}
