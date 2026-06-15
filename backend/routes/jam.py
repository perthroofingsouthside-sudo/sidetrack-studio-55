"""Jam Rooms — multi-member band sessions on the Live Stage.

Workflow:
- Host POST /jam/rooms → gets a short share code (e.g. AB12CD)
- Anyone with the code GET /jam/rooms/{code} to fetch state and join via POST /join
- Presence + chat already flow through /api/ws/chat/{room} (using the code as room)
- Sync master clock (existing /api/sync/*) uses the same code as room_id

Video is currently MOCKED (presence tiles only). Real WebRTC P2P is a Phase 2.
"""
import logging
import random
import string
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()


def _gen_code(n: int = 6) -> str:
    """Short, human-readable, ambiguous-character-free code."""
    alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(alphabet, k=n))


# ── MODELS ────────────────────────────────────────

class RoomCreate(BaseModel):
    host_id: str
    host_name: Optional[str] = None
    song_id: Optional[str] = None
    song_title: Optional[str] = None
    song_artist: Optional[str] = None


class RoomJoin(BaseModel):
    user_id: str
    user_name: Optional[str] = None
    role: Optional[str] = "vocals"   # vocals | guitar | bass | drums | keys | viewer


class RoomLeave(BaseModel):
    user_id: str


class RoomSong(BaseModel):
    user_id: str
    song_id: Optional[str] = None
    song_title: Optional[str] = None
    song_artist: Optional[str] = None


# ── ROOM ENDPOINTS ────────────────────────────────

@router.post("/jam/rooms")
async def create_room(payload: RoomCreate):
    # Pick a unique code (retry up to 5 times)
    for _ in range(5):
        code = _gen_code()
        existing = await db.jam_rooms.find_one({"code": code}, {"_id": 0})
        if not existing:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not allocate room code")

    now = datetime.now(timezone.utc).isoformat()
    room = {
        "id": str(uuid.uuid4()),
        "code": code,
        "host_id": payload.host_id,
        "host_name": payload.host_name or "Host",
        "song_id": payload.song_id,
        "song_title": payload.song_title,
        "song_artist": payload.song_artist,
        "status": "lobby",   # lobby | live | recording | wrapped
        "members": [{
            "user_id": payload.host_id,
            "user_name": payload.host_name or "Host",
            "role": "host",
            "joined_at": now,
            "is_host": True,
        }],
        "created_at": now,
        "updated_at": now,
    }
    await db.jam_rooms.insert_one(room.copy())
    logger.info(f"[Jam] room created code={code} host={payload.host_id}")
    return {"success": True, "room": room, "code": code}


@router.get("/jam/rooms/{code}")
async def get_room(code: str):
    code = (code or "").upper().strip()
    room = await db.jam_rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"success": True, "room": room}


@router.post("/jam/rooms/{code}/join")
async def join_room(code: str, payload: RoomJoin):
    code = (code or "").upper().strip()
    room = await db.jam_rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    # Cap members at 5 total (host + 4)
    members = [m for m in room.get("members", []) if m["user_id"] != payload.user_id]
    if len(members) >= 5:
        raise HTTPException(status_code=403, detail="Room is full (max 5)")

    now = datetime.now(timezone.utc).isoformat()
    new_member = {
        "user_id": payload.user_id,
        "user_name": payload.user_name or f"Member{len(members)+1}",
        "role": payload.role or "vocals",
        "joined_at": now,
        "is_host": payload.user_id == room.get("host_id"),
    }
    members.append(new_member)
    await db.jam_rooms.update_one(
        {"code": code},
        {"$set": {"members": members, "updated_at": now}},
    )
    logger.info(f"[Jam] {payload.user_id} joined {code} as {new_member['role']}")
    room["members"] = members
    return {"success": True, "room": room, "you": new_member}


@router.post("/jam/rooms/{code}/leave")
async def leave_room(code: str, payload: RoomLeave):
    code = (code or "").upper().strip()
    room = await db.jam_rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    members = [m for m in room.get("members", []) if m["user_id"] != payload.user_id]
    now = datetime.now(timezone.utc).isoformat()
    # If the host leaves, dissolve the room
    if payload.user_id == room.get("host_id"):
        await db.jam_rooms.update_one(
            {"code": code},
            {"$set": {"status": "wrapped", "members": [], "updated_at": now}},
        )
        return {"success": True, "wrapped": True}
    await db.jam_rooms.update_one(
        {"code": code},
        {"$set": {"members": members, "updated_at": now}},
    )
    return {"success": True, "wrapped": False}


@router.post("/jam/rooms/{code}/select-song")
async def select_song(code: str, payload: RoomSong):
    code = (code or "").upper().strip()
    room = await db.jam_rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if payload.user_id != room.get("host_id"):
        raise HTTPException(status_code=403, detail="Only the host can pick the song")
    now = datetime.now(timezone.utc).isoformat()
    await db.jam_rooms.update_one(
        {"code": code},
        {"$set": {
            "song_id": payload.song_id,
            "song_title": payload.song_title,
            "song_artist": payload.song_artist,
            "updated_at": now,
        }},
    )
    return {"success": True}


@router.post("/jam/rooms/{code}/status")
async def update_status(code: str, payload: dict):
    code = (code or "").upper().strip()
    status_ = (payload or {}).get("status")
    if status_ not in ("lobby", "live", "recording", "wrapped"):
        raise HTTPException(status_code=400, detail="Invalid status")
    now = datetime.now(timezone.utc).isoformat()
    res = await db.jam_rooms.update_one(
        {"code": code},
        {"$set": {"status": status_, "updated_at": now}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"success": True, "status": status_}


# ── PUBLISHING DESTINATIONS ───────────────────────

class PublishRequest(BaseModel):
    user_id: str
    recording_id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    destinations: List[str]   # ["youtube", "tiktok", "instagram", "internal_live", "rtmp"]
    rtmp_url: Optional[str] = None
    rtmp_key: Optional[str] = None


@router.post("/publish/queue")
async def queue_publish(payload: PublishRequest):
    """Queue a publish job. Currently logs intent; real OAuth handoff lives on
    the destination-specific endpoints once the user connects each service.
    """
    valid = {"youtube", "tiktok", "instagram", "twitter", "internal_live", "rtmp"}
    bad = [d for d in payload.destinations if d not in valid]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unknown destinations: {bad}")
    now = datetime.now(timezone.utc).isoformat()
    job_id = str(uuid.uuid4())
    doc = {
        "id": job_id,
        "user_id": payload.user_id,
        "recording_id": payload.recording_id,
        "title": payload.title,
        "description": payload.description,
        "destinations": payload.destinations,
        "rtmp_url": payload.rtmp_url,
        "rtmp_key": payload.rtmp_key,
        "status": "queued",
        "created_at": now,
    }
    await db.publish_jobs.insert_one(doc.copy())
    logger.info(f"[Publish] job={job_id} user={payload.user_id} dest={payload.destinations}")
    # Per-destination status — surface what's wired vs what needs the user's connection
    per_dest = {}
    for d in payload.destinations:
        if d == "internal_live":
            per_dest[d] = {"status": "live", "note": "Streaming to in-app viewers via WebSocket"}
        elif d == "rtmp":
            ok = bool(payload.rtmp_url and payload.rtmp_key)
            per_dest[d] = {"status": "ready" if ok else "missing_credentials",
                           "note": "Provide RTMP URL + key (Twitch / YouTube Live / etc.)"}
        elif d == "youtube":
            per_dest[d] = {"status": "needs_oauth", "note": "Connect YouTube via Google OAuth to enable upload"}
        elif d == "tiktok":
            per_dest[d] = {"status": "pending_approval",
                           "note": "Requires TikTok Content Posting API developer approval"}
        elif d == "instagram":
            per_dest[d] = {"status": "share_only",
                           "note": "IG Graph API requires a Business account; opening native share for now"}
        elif d == "twitter":
            per_dest[d] = {"status": "share_only",
                           "note": "Native Twitter web intent (no upload API for video without paid v2 elevated access)"}
    return {"success": True, "job_id": job_id, "destinations": per_dest}
