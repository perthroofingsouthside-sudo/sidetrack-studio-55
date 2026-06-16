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
import hashlib

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
    # Deterministic pattern via SHA-256 byte-stream of the input tuple — same inputs
    # always yield the same beat pattern. NOT used for security, just reproducibility.
    seed_input = f"{payload.genre}|{payload.bpm}|{payload.bars}|{payload.key}".encode("utf-8")
    digest = hashlib.sha256(seed_input).digest()
    # Expand to enough bytes for all four stems × bars × 4 steps
    needed = payload.bars * 4 * 4
    stream = bytearray()
    while len(stream) < needed:
        stream.extend(hashlib.sha256(stream + digest).digest())

    def take(offset: int, threshold: int) -> List[int]:
        """Read `bars*4` bytes starting at `offset` and return 1 if byte > threshold else 0."""
        size = payload.bars * 4
        return [1 if stream[offset + i] > threshold else 0 for i in range(size)]

    step = payload.bars * 4
    pattern = {
        "kick":  take(0 * step, 127),   # ~50% density
        "snare": take(1 * step, 178),   # ~30% density
        "hihat": take(2 * step, 76),    # ~70% density
        "bass":  take(3 * step, 102),   # ~40% density
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



# Imports for typing in the new section
from typing import Dict


# ── HUM-TO-BEAT MIDI ──────────────────────────────
# Convert a hummed pitch sequence into a Dr. Dre-style MIDI beat.
# Frontend captures mic → autocorrelation pitch detection → posts pitches[].

_NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _freq_to_midi(freq: float) -> int:
    if freq <= 20 or freq > 5000:
        return 0
    import math
    return int(round(69 + 12 * math.log2(freq / 440.0)))


def _midi_to_name(midi: int) -> str:
    if midi <= 0:
        return ""
    return f"{_NOTE_NAMES[midi % 12]}{(midi // 12) - 1}"


class HumBeatRequest(BaseModel):
    user_id: str
    pitches: List[float]
    sample_interval_ms: int = 50
    genre: str = "hip_hop_top200"
    quantize_to: int = 16


@router.post("/studio/beat/hum")
async def hum_to_beat(payload: HumBeatRequest):
    """Convert a hummed pitch sequence into a Dr. Dre-style MIDI beat."""
    if payload.genre not in ALLOWED_GENRES:
        raise HTTPException(status_code=400, detail=f"Genre must be one of: {ALLOWED_GENRES}")
    if not payload.pitches or len(payload.pitches) < 4:
        raise HTTPException(status_code=400, detail="Need at least 4 pitch samples")

    raw_notes: List[dict] = []
    for i, hz in enumerate(payload.pitches):
        midi = _freq_to_midi(float(hz))
        t_ms = i * payload.sample_interval_ms
        if midi > 0:
            raw_notes.append({"t_ms": t_ms, "midi": midi})

    if not raw_notes:
        raise HTTPException(status_code=400, detail="No detectable pitch — hum louder")

    grouped: List[dict] = []
    cur = {"midi": raw_notes[0]["midi"], "t_start": raw_notes[0]["t_ms"], "t_end": raw_notes[0]["t_ms"]}
    for n in raw_notes[1:]:
        if abs(n["midi"] - cur["midi"]) <= 1 and (n["t_ms"] - cur["t_end"]) < (payload.sample_interval_ms * 3):
            cur["t_end"] = n["t_ms"]
        else:
            grouped.append(cur)
            cur = {"midi": n["midi"], "t_start": n["t_ms"], "t_end": n["t_ms"]}
    grouped.append(cur)

    total_ms = grouped[-1]["t_end"] - grouped[0]["t_start"]
    if total_ms < 200:
        bpm = 90
    else:
        sec = max(0.5, total_ms / 1000.0)
        bpm = int(round((2 * 4 * 60) / sec))
        bpm = max(60, min(180, bpm))
    sec_per_beat = 60.0 / bpm
    sec_per_step = sec_per_beat / 4
    grid_size = payload.quantize_to * 2

    notes: List[dict] = []
    t0 = grouped[0]["t_start"]
    for g in grouped:
        rel_sec = (g["t_start"] - t0) / 1000.0
        step = int(round(rel_sec / sec_per_step))
        if 0 <= step < grid_size:
            dur_steps = max(1, int(round((g["t_end"] - g["t_start"]) / 1000.0 / sec_per_step)))
            notes.append({
                "step": step, "duration_steps": dur_steps,
                "midi": g["midi"], "name": _midi_to_name(g["midi"]),
            })

    kick = [0] * grid_size
    snare = [0] * grid_size
    hihat = [0] * grid_size
    bass = [0] * grid_size
    for bar_start in range(0, grid_size, 16):
        for off in (0, 8):
            kick[bar_start + off] = 1
        for off in (4, 12):
            snare[bar_start + off] = 1
        for off in range(0, 16, 2):
            hihat[bar_start + off] = 1
    deepest_per_quarter = {}
    for n in notes:
        q = n["step"] // 4
        if q not in deepest_per_quarter or n["midi"] < deepest_per_quarter[q]["midi"]:
            deepest_per_quarter[q] = n
    bass_notes: List[dict] = []
    for q, n in deepest_per_quarter.items():
        step = q * 4
        if step < grid_size:
            bass[step] = 1
            bass_notes.append({"step": step, "midi": max(24, n["midi"] - 12),
                               "name": _midi_to_name(max(24, n["midi"] - 12))})

    beat_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": beat_id, "user_id": payload.user_id,
        "genre": payload.genre, "genre_label": GENRE_LABELS[payload.genre],
        "bpm": bpm, "bars": grid_size // 16, "grid_size": grid_size,
        "melody_notes": notes, "bass_notes": bass_notes,
        "pattern": {"kick": kick, "snare": snare, "hihat": hihat, "bass": bass},
        "engine": "hum_to_midi_v1", "source": "hum",
        "created_at": now,
    }
    await db.beats.insert_one(doc.copy())
    logger.info(f"[HumBeat] id={beat_id} user={payload.user_id} bpm={bpm} notes={len(notes)}")
    return {"success": True, "beat": doc}


# ── VIBE-MATCH BEHAVIOR TRACKING ──────────────────

class MixBehaviorLog(BaseModel):
    user_id: str
    track_id: Optional[str] = None
    event: str
    stem: Optional[str] = None
    value: Optional[float] = None
    genre: Optional[str] = None


@router.post("/discover/mix-behavior")
async def log_mix_behavior(payload: MixBehaviorLog):
    if payload.event not in ("mute", "solo", "volume", "beat_gen", "cleanup_on", "play", "skip"):
        raise HTTPException(status_code=400, detail="Invalid event")
    now = datetime.now(timezone.utc).isoformat()
    await db.mix_behavior.insert_one({
        "user_id": payload.user_id, "track_id": payload.track_id,
        "event": payload.event, "stem": payload.stem,
        "value": payload.value, "genre": payload.genre, "ts": now,
    })
    return {"success": True}


@router.get("/discover/vibe/{user_id}")
async def vibe_profile(user_id: str):
    cursor = db.mix_behavior.find({"user_id": user_id}, {"_id": 0}).sort("ts", -1).limit(200)
    events = await cursor.to_list(length=200)
    stem_score: Dict[str, int] = {}
    genre_score: Dict[str, int] = {}
    for ev in events:
        if ev.get("stem"):
            stem_score[ev["stem"]] = stem_score.get(ev["stem"], 0) + (3 if ev["event"] == "solo" else 1)
        if ev.get("genre"):
            genre_score[ev["genre"]] = genre_score.get(ev["genre"], 0) + 1
    top_stems = sorted(stem_score.items(), key=lambda x: -x[1])[:3]
    top_genres = sorted(genre_score.items(), key=lambda x: -x[1])[:3]
    return {
        "success": True, "user_id": user_id, "event_count": len(events),
        "top_stems": [{"stem": s, "score": v} for s, v in top_stems],
        "top_genres": [{"genre": g, "score": v} for g, v in top_genres],
    }
