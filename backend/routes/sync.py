"""Global Sync — Master Clock for group jams.
Lightweight in-memory clock (per room) so collaborators can align bars/beats.
Client polls /sync/state to render a server-synchronized playhead.
"""
import time
import logging
from typing import Dict
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory room clocks. For multi-instance deployment, replace with Redis.
_ROOMS: Dict[str, dict] = {}


class StartRequest(BaseModel):
    room_id: str
    bpm: int = 120
    beats_per_bar: int = 4
    user_id: str = ""


class StopRequest(BaseModel):
    room_id: str


@router.post("/sync/start")
async def sync_start(payload: StartRequest):
    """Start (or restart) the master clock for a room."""
    if payload.bpm < 40 or payload.bpm > 240:
        raise HTTPException(status_code=400, detail="BPM must be 40-240")
    t0 = time.time()
    _ROOMS[payload.room_id] = {
        "t0": t0,
        "bpm": payload.bpm,
        "beats_per_bar": payload.beats_per_bar,
        "host": payload.user_id,
        "running": True,
    }
    logger.info(f"[Sync] room={payload.room_id} started bpm={payload.bpm} host={payload.user_id}")
    return {"success": True, "room_id": payload.room_id, "t0_server": t0, "bpm": payload.bpm}


@router.post("/sync/stop")
async def sync_stop(payload: StopRequest):
    room = _ROOMS.get(payload.room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room["running"] = False
    return {"success": True, "room_id": payload.room_id}


@router.get("/sync/state/{room_id}")
async def sync_state(room_id: str):
    """Return server-authoritative beat/bar position for the room."""
    room = _ROOMS.get(room_id)
    if not room:
        return {"success": True, "running": False, "room_id": room_id}
    if not room["running"]:
        return {"success": True, "running": False, "room_id": room_id,
                "bpm": room["bpm"], "beats_per_bar": room["beats_per_bar"]}
    now = time.time()
    elapsed_sec = now - room["t0"]
    sec_per_beat = 60.0 / room["bpm"]
    total_beats = elapsed_sec / sec_per_beat
    bar = int(total_beats // room["beats_per_bar"]) + 1
    beat_in_bar = int(total_beats % room["beats_per_bar"]) + 1
    frac = (total_beats % 1)
    return {
        "success": True,
        "running": True,
        "room_id": room_id,
        "bpm": room["bpm"],
        "beats_per_bar": room["beats_per_bar"],
        "t0_server": room["t0"],
        "server_now": now,
        "elapsed_sec": round(elapsed_sec, 3),
        "bar": bar,
        "beat": beat_in_bar,
        "beat_fraction": round(frac, 3),
        "host": room.get("host", ""),
    }


@router.get("/sync/rooms")
async def list_rooms():
    """Quick admin endpoint — list active rooms."""
    return {"success": True, "rooms": [
        {"room_id": k, "bpm": v["bpm"], "running": v["running"], "host": v.get("host", "")}
        for k, v in _ROOMS.items()
    ]}
