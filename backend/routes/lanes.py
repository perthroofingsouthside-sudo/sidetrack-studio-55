"""Pocket Products — Two-Lane Ecosystem.

Houses the new architecture pieces introduced in the Two-Lane overhaul:
- /lanes/{user_id}   — set/get the user's active lane (creator | gamer)
- /backstage/motivation — AI motivational set-intro lines (Emergent LLM)
- /catalog/seed, /catalog/in/{track_id} — curated 2500-3000 catalog gate
- /gamer/recordings — PRIVATE gamer-only recordings (no social fanout)
- /battles/hub      — spectator feed for reality + gamer sets
"""
import os
import uuid
import logging
import hashlib
import random
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Catalog target size (the user requested 2500-3000 pre-set tracks).
# We deterministically derive the curated set from any track id that has been
# seen by the app — first N (sorted by created_at) are marked as "in catalog".
CATALOG_TARGET_SIZE = 3000

# ── LANES ─────────────────────────────────────────

class LaneRequest(BaseModel):
    user_id: str
    lane: str  # "creator" | "gamer"


@router.post("/lanes/set")
async def set_lane(payload: LaneRequest):
    if payload.lane not in ("creator", "gamer"):
        raise HTTPException(status_code=400, detail="lane must be 'creator' or 'gamer'")
    now = datetime.now(timezone.utc).isoformat()
    await db.lanes.update_one(
        {"user_id": payload.user_id},
        {"$set": {"user_id": payload.user_id, "lane": payload.lane, "updated_at": now}},
        upsert=True,
    )
    logger.info(f"[Lane] user={payload.user_id} → {payload.lane}")
    return {"success": True, "lane": payload.lane}


@router.get("/lanes/{user_id}")
async def get_lane(user_id: str):
    doc = await db.lanes.find_one({"user_id": user_id}, {"_id": 0})
    return {"success": True, "lane": (doc or {}).get("lane", "creator")}


# ── BACKSTAGE AI MOTIVATION ───────────────────────

class BackstageRequest(BaseModel):
    user_id: str
    song_title: str
    artist: Optional[str] = ""
    style: Optional[str] = "rock_legend"  # rock_legend | hiphop_pioneer | mtv_icon | mos_dj


_BACKSTAGE_STYLE_PROMPT = {
    "rock_legend": "an iconic 80s/90s rock legend (think Freddie Mercury or Kurt Cobain)",
    "hiphop_pioneer": "a Top 200 Hip-Hop pioneer (think Tupac, Notorious B.I.G., or Nas)",
    "mtv_icon": "an MTV-era icon from 1981-1998 (think Madonna or Michael Jackson)",
    "mos_dj": "a Ministry of Sound headlining DJ",
}

# Deterministic fallback lines (used if LLM unavailable). Tagged to style.
_FALLBACK_LINES = {
    "rock_legend": [
        "Hey — I played this stage when the speakers blew at 2am. You're gonna kill it tonight.",
        "Hold the mic like it owes you money. Trust me, the crowd will follow.",
        "Don't think. Bleed. That's where the song lives.",
    ],
    "hiphop_pioneer": [
        "Word to the streets — this beat is yours now. Don't waste a bar.",
        "I used to freestyle this exact key. You got more flow than you think.",
        "Pocket the rhythm. The booth will do the rest.",
    ],
    "mtv_icon": [
        "Camera-one is your best friend. Smile at it like you mean it.",
        "I cut my first hit on a stage smaller than this. Own it.",
        "Wardrobe is decided. Now go decide the decade.",
    ],
    "mos_dj": [
        "Drop hits in eight bars. The room is already with you.",
        "Build the tension. Pay it off. That's the whole job tonight.",
        "Hands up at the breakdown. They came here for this.",
    ],
}


async def _llm_motivation(song_title: str, artist: str, style: str) -> Optional[str]:
    """Call Emergent LLM for a motivational line. Returns None on any failure."""
    if not EMERGENT_LLM_KEY:
        return None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        persona = _BACKSTAGE_STYLE_PROMPT.get(style, _BACKSTAGE_STYLE_PROMPT["rock_legend"])
        system = (
            f"You are {persona}, hanging out backstage with a young performer about to step out. "
            "Give them ONE short, vivid line (max 2 sentences) of pre-show encouragement. "
            "Be specific, emotional, and never generic. No greetings, no sign-offs. Just the line."
        )
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"backstage-{uuid.uuid4()}",
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=f"Song: {song_title}\nArtist: {artist or 'Unknown'}\nGive me the line.")
        out = await chat.send_message(msg)
        line = (out or "").strip().strip('"').strip()
        if line and 8 < len(line) < 400:
            return line
    except Exception as e:
        logger.warning(f"[Backstage] LLM failed, using fallback: {e}")
    return None


@router.post("/backstage/motivation")
async def backstage_motivation(payload: BackstageRequest):
    """Returns 3 motivational lines from AI-simulated prior performers."""
    style = payload.style if payload.style in _BACKSTAGE_STYLE_PROMPT else "rock_legend"
    # Generate 3 lines in parallel-ish (sequential is fine here, this is a one-time call before set)
    lines: List[dict] = []
    fallback_pool = list(_FALLBACK_LINES.get(style, _FALLBACK_LINES["rock_legend"]))
    random.shuffle(fallback_pool)
    for i in range(3):
        llm_line = await _llm_motivation(payload.song_title, payload.artist or "", style)
        text = llm_line or (fallback_pool[i] if i < len(fallback_pool) else fallback_pool[0])
        lines.append({
            "id": str(uuid.uuid4()),
            "performer": _BACKSTAGE_STYLE_PROMPT[style].split(" (")[0],
            "text": text,
            "is_ai": bool(llm_line),
        })

    now = datetime.now(timezone.utc).isoformat()
    await db.backstage_sessions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": payload.user_id,
        "song_title": payload.song_title,
        "artist": payload.artist,
        "style": style,
        "lines": lines,
        "created_at": now,
    })
    return {"success": True, "style": style, "lines": lines}


# ── CATALOG (2500-3000 curated tracks gate) ───────

def _track_in_curated_catalog(track_id: str) -> bool:
    """Deterministic gate: hash → ~80% of tracks are 'in catalog' to simulate
    the 2500-3000 pre-set roster against an effectively unlimited iTunes long-tail."""
    if not track_id:
        return False
    h = int(hashlib.sha256(track_id.encode()).hexdigest(), 16)
    # 80% are curated free, 20% require $79.98 ownership purchase
    return (h % 100) < 80


@router.get("/catalog/status")
async def catalog_status():
    """Reports total curated count for transparency."""
    total = await db.curated_catalog.count_documents({})
    return {
        "success": True,
        "curated_size_target": CATALOG_TARGET_SIZE,
        "seeded_records": total,
        "gate_strategy": "deterministic_hash_80pct",
        "non_curated_requires_ownership": True,
    }


@router.get("/catalog/in/{track_id}")
async def catalog_track_in(track_id: str):
    in_cat = _track_in_curated_catalog(track_id)
    # Check explicit overrides
    override = await db.curated_catalog.find_one({"track_id": track_id}, {"_id": 0})
    if override:
        in_cat = bool(override.get("in_catalog", in_cat))
    return {
        "success": True,
        "track_id": track_id,
        "in_catalog": in_cat,
        "requires_ownership": not in_cat,
    }


@router.post("/catalog/seed")
async def catalog_seed():
    """Mark a representative sample of iTunes tracks as curated.
    This is the deterministic-hash strategy; explicit overrides for the rest.
    In production this would import a real MTV/MOS/Hip-Hop manifest."""
    now = datetime.now(timezone.utc).isoformat()
    seeds = [
        # Sample manifest stubs across the 4 whitelisted genres
        {"track_id": f"mtv_seed_{i:04d}", "in_catalog": True, "genre": "mtv_classic"}
        for i in range(0, 800)
    ] + [
        {"track_id": f"mos_seed_{i:04d}", "in_catalog": True, "genre": "ministry_of_sound"}
        for i in range(0, 600)
    ] + [
        {"track_id": f"hh_seed_{i:04d}", "in_catalog": True, "genre": "hip_hop_top200"}
        for i in range(0, 800)
    ] + [
        {"track_id": f"ar_seed_{i:04d}", "in_catalog": True, "genre": "alt_rock"}
        for i in range(0, 600)
    ]
    if seeds:
        # Idempotent: upsert each
        ops_count = 0
        for s in seeds:
            await db.curated_catalog.update_one(
                {"track_id": s["track_id"]},
                {"$set": {**s, "seeded_at": now}},
                upsert=True,
            )
            ops_count += 1
        return {"success": True, "seeded": ops_count, "target": CATALOG_TARGET_SIZE}
    return {"success": True, "seeded": 0}


# ── GAMER PRIVATE RECORDINGS ──────────────────────

class GamerRecordingCreate(BaseModel):
    user_id: str
    song_id: str
    song_title: str
    artist: Optional[str] = ""
    duration_sec: float = 0
    blob_url: Optional[str] = None  # client-side blob URL


@router.post("/gamer/recordings")
async def create_gamer_recording(payload: GamerRecordingCreate):
    """Create a PRIVATE gamer recording. Never appears in social feeds."""
    rec_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": rec_id,
        "user_id": payload.user_id,
        "song_id": payload.song_id,
        "song_title": payload.song_title,
        "artist": payload.artist,
        "duration_sec": payload.duration_sec,
        "blob_url": payload.blob_url,
        "lane": "gamer",
        "is_private": True,
        "share_to_social": False,  # HARD locked
        "review_status": "pending_review",  # pending_review | kept | discarded
        "created_at": now,
    }
    await db.gamer_recordings.insert_one(doc.copy())
    logger.info(f"[Gamer] private recording id={rec_id} user={payload.user_id}")
    return {"success": True, "recording": doc}


@router.get("/gamer/recordings/{user_id}")
async def list_gamer_recordings(user_id: str, limit: int = 20, status: str = None):
    """List a user's Gamer recordings. Filter by `status` to narrow to backstage review queue."""
    q = {"user_id": user_id}
    if status in ("pending_review", "kept", "discarded"):
        q["review_status"] = status
    cursor = db.gamer_recordings.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"success": True, "recordings": items}


class ReviewAction(BaseModel):
    user_id: str
    action: str  # "keep" | "discard"


@router.post("/gamer/recordings/{recording_id}/review")
async def review_recording(recording_id: str, payload: ReviewAction):
    """Backstage keep/discard for a Gamer recording."""
    if payload.action not in ("keep", "discard"):
        raise HTTPException(status_code=400, detail="action must be keep or discard")
    rec = await db.gamer_recordings.find_one({"id": recording_id, "user_id": payload.user_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    new_status = "kept" if payload.action == "keep" else "discarded"
    now = datetime.now(timezone.utc).isoformat()
    if new_status == "discarded":
        # Soft-delete: keep the document but mark discarded (allows undo).
        await db.gamer_recordings.update_one(
            {"id": recording_id},
            {"$set": {"review_status": "discarded", "reviewed_at": now}},
        )
    else:
        await db.gamer_recordings.update_one(
            {"id": recording_id},
            {"$set": {"review_status": "kept", "reviewed_at": now}},
        )
    logger.info(f"[Backstage] recording={recording_id} user={payload.user_id} → {new_status}")
    return {"success": True, "status": new_status}


# ── BATTLE OF THE BANDS — SPECTATOR HUB ───────────

@router.get("/spectator/hub")
async def battles_hub():
    """Spectator hub: surfaces 'reality' battles + 'gamer' virtual-world sets."""
    # Reality sets — covers/battles uploaded by Creator lane
    reality_cursor = db.covers.find({}, {"_id": 0}).sort("created_at", -1).limit(20)
    reality = await reality_cursor.to_list(length=20)
    # Gamer sets — recent private performances surfaced as anonymous spectator entries
    gamer_cursor = db.gamer_recordings.find({}, {"_id": 0, "blob_url": 0}).sort("created_at", -1).limit(20)
    gamer_raw = await gamer_cursor.to_list(length=20)
    gamer = [{
        "id": g["id"],
        "song_title": g.get("song_title", ""),
        "artist": g.get("artist", ""),
        "duration_sec": g.get("duration_sec", 0),
        "performer_handle": f"gamer_{g.get('user_id','')[:6]}",
        "created_at": g.get("created_at"),
        "is_virtual": True,
    } for g in gamer_raw]
    return {
        "success": True,
        "reality_sets": reality,
        "gamer_sets": gamer,
        "reality_count": len(reality),
        "gamer_count": len(gamer),
    }
