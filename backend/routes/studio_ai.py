"""Studio AI — Beat Maker and AI Audio Cleanup engines.
Currently delivers deterministic mocked outputs so the UX pipeline is fully wired
end-to-end. Swap the generator stubs with AudioCraft/Suno/Replicate real calls
later without touching the frontend.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging
import random

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Whitelisted genres for the Catalog Pivot (MTV / MOS / Hip-Hop / Alt-Rock) ──
ALLOWED_GENRES = [
    "mtv_classic",        # 1981-1998 MTV catalog
    "ministry_of_sound",  # MOS-style dance/house
    "hip_hop_top200",     # Top-200 Hip-Hop albums
    "alt_rock",           # Alt-Rock specialization
]

GENRE_LABELS = {
    "mtv_classic": "MTV Classic (1981-1998)",
    "ministry_of_sound": "Ministry of Sound",
    "hip_hop_top200": "Top 200 Hip-Hop",
    "alt_rock": "Alt-Rock",
}


class BeatRequest(BaseModel):
    genre: str
    bpm: int = 120
    bars: int = 8
    key: Optional[str] = "C"
    user_id: str


class CleanupRequest(BaseModel):
    user_id: str
    recording_id: Optional[str] = None
    mode: str = "rock"  # rock | vocal | instrumental
    live: bool = False


@router.get("/studio/genres")
async def list_genres():
    """Whitelisted genres used by Beat Maker + Battle of the Bands catalog pivot."""
    return {
        "success": True,
        "genres": [{"key": k, "label": GENRE_LABELS[k]} for k in ALLOWED_GENRES],
    }


@router.post("/studio/beat/generate")
async def generate_beat(payload: BeatRequest):
    """Generate a beat track (MOCKED — returns a deterministic preview URL).
    Real impl will swap to AudioCraft/Suno/Replicate inference.
    """
    if payload.genre not in ALLOWED_GENRES:
        raise HTTPException(status_code=400, detail=f"Genre must be one of: {ALLOWED_GENRES}")
    if payload.bpm < 60 or payload.bpm > 200:
        raise HTTPException(status_code=400, detail="BPM must be between 60 and 200")
    if payload.bars not in (4, 8, 16, 32):
        raise HTTPException(status_code=400, detail="Bars must be 4, 8, 16 or 32")

    beat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    # Generate a deterministic stem pattern (mock)
    seed = abs(hash(f"{payload.genre}-{payload.bpm}-{payload.bars}-{payload.key}")) % 9999
    rng = random.Random(seed)
    pattern = {
        "kick": [1 if rng.random() > 0.5 else 0 for _ in range(payload.bars * 4)],
        "snare": [1 if rng.random() > 0.7 else 0 for _ in range(payload.bars * 4)],
        "hihat": [1 if rng.random() > 0.3 else 0 for _ in range(payload.bars * 4)],
        "bass": [1 if rng.random() > 0.6 else 0 for _ in range(payload.bars * 4)],
    }

    beat_doc = {
        "id": beat_id,
        "user_id": payload.user_id,
        "genre": payload.genre,
        "genre_label": GENRE_LABELS[payload.genre],
        "bpm": payload.bpm,
        "bars": payload.bars,
        "key": payload.key,
        "pattern": pattern,
        "duration_sec": round((payload.bars * 4 * 60) / payload.bpm, 2),
        "preview_url": f"https://cdn.pocketproducts.app/beats/mock-{beat_id}.mp3",
        "engine": "mock_audiocraft_v1",
        "created_at": now,
    }
    await db.beats.insert_one(beat_doc.copy())
    logger.info(f"[BeatMaker] generated id={beat_id} user={payload.user_id} genre={payload.genre} bpm={payload.bpm}")
    return {"success": True, "beat": beat_doc}


@router.get("/studio/beat/{user_id}")
async def list_user_beats(user_id: str, limit: int = 20):
    """Return a user's generated beats (most recent first)."""
    cursor = db.beats.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
    beats = await cursor.to_list(length=limit)
    return {"success": True, "beats": beats}


@router.post("/studio/cleanup")
async def request_cleanup(payload: CleanupRequest):
    """Trigger AI Audio Cleanup (MOCKED).
    `live=True` returns instant config for the Live Stage stream pipeline.
    Otherwise returns a job record stored in DB.
    """
    if payload.mode not in ("rock", "vocal", "instrumental"):
        raise HTTPException(status_code=400, detail="mode must be rock|vocal|instrumental")

    job_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    # Cleanup parameters per mode
    profile = {
        "rock": {
            "noise_floor_db": -52,
            "de_esser": True,
            "transient_enhance": 0.6,
            "low_cut_hz": 80,
            "compressor_ratio": 3.0,
        },
        "vocal": {
            "noise_floor_db": -48,
            "de_esser": True,
            "transient_enhance": 0.3,
            "low_cut_hz": 100,
            "compressor_ratio": 2.5,
        },
        "instrumental": {
            "noise_floor_db": -56,
            "de_esser": False,
            "transient_enhance": 0.5,
            "low_cut_hz": 60,
            "compressor_ratio": 2.0,
        },
    }[payload.mode]

    job_doc = {
        "id": job_id,
        "user_id": payload.user_id,
        "recording_id": payload.recording_id,
        "mode": payload.mode,
        "live": payload.live,
        "status": "applied" if payload.live else "queued",
        "profile": profile,
        "engine": "mock_aicleanup_v1",
        "created_at": now,
    }
    await db.cleanup_jobs.insert_one(job_doc.copy())
    logger.info(f"[AICleanup] job={job_id} user={payload.user_id} mode={payload.mode} live={payload.live}")
    return {"success": True, "job": job_doc}


@router.get("/studio/cleanup/{user_id}/recent")
async def recent_cleanup(user_id: str, limit: int = 10):
    cursor = db.cleanup_jobs.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(limit)
    jobs = await cursor.to_list(length=limit)
    return {"success": True, "jobs": jobs}
