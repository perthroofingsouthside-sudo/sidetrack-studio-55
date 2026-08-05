"""Grommet Safety + AI Grading + Peer Ratings.

- Age modes: "grommet" (under-18, Gamer lane only) | "adult" (18+, full access)
- Graduation: guardian PIN approval moves a grommet to adult/Creator access
- AI grading: objective pitch/timing scoring for the Gamer lane (no peer grading for minors)
- Peer ratings: 18+ star ratings on creator content, drives Top Rated discovery
"""
import random
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

GROMMET_BLOCK_MESSAGE = "Level up with a guardian to unlock Creator mode."


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


async def get_age_profile(user_id: str) -> dict:
    doc = await db.age_profiles.find_one({"user_id": user_id}, {"_id": 0})
    if not doc:
        return {"user_id": user_id, "mode": "unset", "graduated": False}
    return doc


async def is_grommet(user_id: str) -> bool:
    p = await get_age_profile(user_id)
    return p.get("mode") == "grommet" and not p.get("graduated")


# ── AGE MODE ──────────────────────────────────────

class AgeModeReq(BaseModel):
    user_id: str
    mode: str  # "grommet" | "adult"


@router.post("/safety/age-mode")
async def set_age_mode(req: AgeModeReq):
    if req.mode not in ("grommet", "adult"):
        raise HTTPException(400, "mode must be 'grommet' or 'adult'")
    existing = await get_age_profile(req.user_id)
    if existing.get("graduated"):
        # Graduated accounts stay adult
        return {"success": True, "mode": "adult", "graduated": True}
    await db.age_profiles.update_one(
        {"user_id": req.user_id},
        {"$set": {"user_id": req.user_id, "mode": req.mode, "graduated": False, "updated_at": _now_iso()}},
        upsert=True,
    )
    logger.info(f"[Safety] age-mode user={req.user_id} → {req.mode}")
    return {"success": True, "mode": req.mode, "graduated": False}


@router.get("/safety/age-mode/{user_id}")
async def get_age_mode(user_id: str):
    p = await get_age_profile(user_id)
    grommet = p.get("mode") == "grommet" and not p.get("graduated")
    return {
        "success": True,
        "mode": p.get("mode", "unset"),
        "graduated": bool(p.get("graduated")),
        "is_grommet": grommet,
    }


# ── GUARDIAN GRADUATION ───────────────────────────

class GraduationRequestReq(BaseModel):
    user_id: str
    guardian_name: Optional[str] = ""


@router.post("/safety/graduation/request")
async def request_graduation(req: GraduationRequestReq):
    """Grommet starts graduation — a guardian PIN is issued for in-person approval."""
    p = await get_age_profile(req.user_id)
    if p.get("graduated"):
        return {"success": True, "status": "already_graduated"}
    code = f"{random.randint(0, 9999):04d}"
    await db.graduation_requests.update_one(
        {"user_id": req.user_id},
        {"$set": {
            "user_id": req.user_id,
            "guardian_name": req.guardian_name or "",
            "code": code,
            "status": "pending",
            "attempts": 0,
            "created_at": _now_iso(),
        }},
        upsert=True,
    )
    logger.info(f"[Safety] graduation requested user={req.user_id}")
    return {"success": True, "status": "pending", "guardian_code": code,
            "instructions": "Hand the device to your guardian — they enter this PIN to approve Creator access."}


class GraduationApproveReq(BaseModel):
    user_id: str
    code: str


@router.post("/safety/graduation/approve")
async def approve_graduation(req: GraduationApproveReq):
    """Guardian enters the PIN → grommet graduates to full Creator access."""
    gr = await db.graduation_requests.find_one({"user_id": req.user_id, "status": "pending"}, {"_id": 0})
    if not gr:
        raise HTTPException(404, "No pending graduation request")
    if gr.get("attempts", 0) >= 5:
        raise HTTPException(429, "Too many attempts — request a new PIN")
    if req.code != gr.get("code"):
        await db.graduation_requests.update_one({"user_id": req.user_id}, {"$inc": {"attempts": 1}})
        raise HTTPException(403, "Incorrect PIN")
    now = _now_iso()
    await db.graduation_requests.update_one(
        {"user_id": req.user_id}, {"$set": {"status": "approved", "approved_at": now}}
    )
    await db.age_profiles.update_one(
        {"user_id": req.user_id},
        {"$set": {"user_id": req.user_id, "mode": "adult", "graduated": True, "graduated_at": now}},
        upsert=True,
    )
    logger.info(f"[Safety] graduation APPROVED user={req.user_id}")
    return {"success": True, "status": "approved", "mode": "adult", "graduated": True}


# ── AI GRADING (Gamer lane — objective pitch + timing only) ──

class GradeReq(BaseModel):
    user_id: str
    context: str = "learn"          # learn | recording
    song_title: Optional[str] = ""
    pitch_accuracy: float = Field(ge=0, le=100)
    timing_accuracy: float = Field(ge=0, le=100)


def _letter(score: float) -> str:
    if score >= 95: return "S"
    if score >= 85: return "A"
    if score >= 70: return "B"
    if score >= 55: return "C"
    return "D"


@router.post("/gamer/grade")
async def ai_grade(req: GradeReq):
    """Objective AI grade: 60% pitch + 40% timing. No subjective peer input for minors."""
    score = round(req.pitch_accuracy * 0.6 + req.timing_accuracy * 0.4, 1)
    grade = _letter(score)
    doc = {
        "user_id": req.user_id,
        "context": req.context,
        "song_title": req.song_title,
        "pitch_score": round(req.pitch_accuracy, 1),
        "timing_score": round(req.timing_accuracy, 1),
        "score": score,
        "grade": grade,
        "graded_at": _now_iso(),
    }
    await db.gamer_grades.insert_one(dict(doc))
    return {"success": True, **doc}


@router.get("/gamer/grades/{user_id}")
async def grade_history(user_id: str, limit: int = 20):
    grades = await db.gamer_grades.find({"user_id": user_id}, {"_id": 0}).sort("graded_at", -1).to_list(limit)
    return {"success": True, "grades": grades}


# ── PEER RATINGS (Creator lane — 18+ only) ────────

class RatingReq(BaseModel):
    rater_id: str
    item_id: str
    item_type: str = "battle"       # battle | cover | recording
    stars: int = Field(ge=1, le=5)
    review: Optional[str] = ""


@router.post("/ratings")
async def rate_item(req: RatingReq):
    if await is_grommet(req.rater_id):
        raise HTTPException(403, f"Peer grading is 18+ only. {GROMMET_BLOCK_MESSAGE}")
    await db.peer_ratings.update_one(
        {"rater_id": req.rater_id, "item_id": req.item_id},
        {"$set": {
            "rater_id": req.rater_id,
            "item_id": req.item_id,
            "item_type": req.item_type,
            "stars": req.stars,
            "review": (req.review or "")[:400],
            "rated_at": _now_iso(),
        }},
        upsert=True,
    )
    return await get_item_rating(req.item_id, rater_id=req.rater_id)


@router.get("/ratings/top")
async def top_rated(item_type: str = "battle", limit: int = 10):
    pipeline = [
        {"$match": {"item_type": item_type}},
        {"$group": {"_id": "$item_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
        {"$sort": {"avg": -1, "count": -1}},
        {"$limit": limit},
    ]
    rows = await db.peer_ratings.aggregate(pipeline).to_list(limit)
    items = [{"item_id": r["_id"], "avg": round(r["avg"], 2), "count": r["count"]} for r in rows]
    return {"success": True, "item_type": item_type, "top": items}


@router.get("/ratings/{item_id}")
async def get_item_rating(item_id: str, rater_id: str = ""):
    pipeline = [
        {"$match": {"item_id": item_id}},
        {"$group": {"_id": None, "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}},
    ]
    rows = await db.peer_ratings.aggregate(pipeline).to_list(1)
    avg = round(rows[0]["avg"], 2) if rows else 0
    count = rows[0]["count"] if rows else 0
    mine = None
    if rater_id:
        m = await db.peer_ratings.find_one({"item_id": item_id, "rater_id": rater_id}, {"_id": 0})
        mine = m.get("stars") if m else None
    return {"success": True, "item_id": item_id, "avg": avg, "count": count, "my_stars": mine}
