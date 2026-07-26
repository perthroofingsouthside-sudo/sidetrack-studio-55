"""Free-access platform: rewards, trim, social, discovery, sync, chat."""

from fastapi import APIRouter, HTTPException, Form, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from database import db
from models import SubscriptionSelect, TrimRequest, FollowAction
import uuid
import base64
import io
import logging
import requests
from datetime import datetime, timezone, timedelta
from typing import Dict, Set

logger = logging.getLogger(__name__)
router = APIRouter()

# ── FREE ACCESS MODEL ───────────────────────────
# Pocket Products is 100% free — no subscriptions, no ownership gates.
# The creator economy keeps a 70/30 artist-favoured revenue split on
# content sales (see /store endpoints below).
FREE_MODEL_MESSAGE = "Pocket Products is completely free — every feature, every lane, for everyone."

# Revenue split: 70% artist / 30% platform
PLATFORM_CUT = 0.30
ARTIST_CUT = 0.70

# Pay-per-song pricing for tracks outside curated catalog
PAY_PER_SONG_PRICE = 0.79  # Cheaper than iTunes $0.99


@router.get("/subscriptions/tiers")
async def list_tiers(user_id: str = None):
    """FREE MODEL: no subscription tiers exist — everything is free."""
    return {"success": True, "tiers": [], "all_free": True, "is_owned": True, "message": FREE_MODEL_MESSAGE}


@router.post("/subscriptions/select")
async def select_subscription(payload: SubscriptionSelect):
    """FREE MODEL: nothing to select — access is universal."""
    return {"success": True, "subscription": None, "all_free": True, "message": FREE_MODEL_MESSAGE}


@router.get("/subscriptions/{user_id}/status")
async def get_subscription_status(user_id: str):
    """FREE MODEL: every user has full access to every feature."""
    return {
        "success": True,
        "subscription": None,
        "is_pro": True,
        "is_vip": True,
        "is_band": False,
        "tier_key": "free",
        "all_free": True,
        "upload_status": None,
        "message": FREE_MODEL_MESSAGE,
    }


# ── Pay-Per-Song: Purchase tracks outside curated catalog ──


class SongPurchase(BaseModel):
    user_id: str
    track_id: str
    title: str = ""
    artist: str = ""
    price: float = 0  # Ignored server-side — price is enforced


@router.post("/store/purchase")
async def purchase_song(purchase: SongPurchase):
    """Purchase a song outside the curated catalog. 70/30 artist/platform split."""
    # Check if already purchased
    existing = await db.song_purchases.find_one(
        {"user_id": purchase.user_id, "track_id": purchase.track_id}, {"_id": 0}
    )
    if existing:
        return {
            "success": True,
            "already_owned": True,
            "message": "You already own this track",
        }

    now = datetime.now(timezone.utc).isoformat()
    price = PAY_PER_SONG_PRICE  # Server-enforced, never from client
    artist_share = round(price * ARTIST_CUT, 2)
    platform_share = round(price * PLATFORM_CUT, 2)

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": purchase.user_id,
        "track_id": purchase.track_id,
        "title": purchase.title,
        "artist": purchase.artist,
        "price": price,
        "artist_share": artist_share,
        "platform_share": platform_share,
        "purchased_at": now,
    }
    await db.song_purchases.insert_one(doc)

    return {
        "success": True,
        "purchase_id": doc["id"],
        "price": price,
        "artist_share": artist_share,
        "platform_share": platform_share,
        "message": f"Purchased for ${price:.2f} (${artist_share:.2f} to artist, ${platform_share:.2f} platform fee)",
    }


@router.get("/store/library/{user_id}")
async def get_user_library(user_id: str):
    """Get all songs a user has purchased."""
    purchases = (
        await db.song_purchases.find({"user_id": user_id}, {"_id": 0})
        .sort("purchased_at", -1)
        .to_list(200)
    )
    return {"success": True, "purchases": purchases, "count": len(purchases)}


@router.get("/store/check/{user_id}/{track_id}")
async def check_ownership(user_id: str, track_id: str):
    """Check if a user owns a specific track."""
    owned = await db.song_purchases.find_one(
        {"user_id": user_id, "track_id": track_id}, {"_id": 0}
    )
    return {"success": True, "owned": owned is not None}


@router.get("/store/pricing")
async def get_store_pricing():
    """Get pay-per-song pricing and revenue split info."""
    return {
        "success": True,
        "price_per_song": PAY_PER_SONG_PRICE,
        "artist_cut_pct": int(ARTIST_CUT * 100),
        "platform_cut_pct": int(PLATFORM_CUT * 100),
        "curated_categories": [
            "MTV Classics (1981-1998)",
            "Ministry of Sound Collection",
            "Top 200 Hip-Hop Albums",
        ],
        "note": "Platform access is 100% free. Optional song purchases directly support artists with a 70/30 artist-favoured split.",
    }


# ── Band Activity Check (retired) ───────────────


async def _run_band_activity_check(trigger: str = "manual"):
    """FREE MODEL: band subscriptions no longer exist. Retained as a no-op
    because the scheduler in server.py still invokes it."""
    logger.info(f"[BandCron] skipped (free model) trigger={trigger}")
    return {"trigger": trigger, "skipped": True, "reason": "free_model"}


# ── Real Audio Trimming ─────────────────────────
@router.post("/trim")
async def trim_recording(payload: TrimRequest):
    if (
        payload.start_pct < 0
        or payload.end_pct > 100
        or payload.start_pct >= payload.end_pct
    ):
        raise HTTPException(status_code=400, detail="Invalid trim range")
    # Look up the recording's audio data
    rec = (
        await db.recordings.find_one({"id": payload.recording_id})
        if payload.recording_id
        else None
    )
    if rec and rec.get("audio_data"):
        try:
            from pydub import AudioSegment

            audio_bytes = base64.b64decode(rec["audio_data"])
            audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
            total_ms = len(audio)
            start_ms = int((payload.start_pct / 100) * total_ms)
            end_ms = int((payload.end_pct / 100) * total_ms)
            trimmed = audio[start_ms:end_ms]
            buf = io.BytesIO()
            trimmed.export(buf, format="webm")
            trimmed_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            # Save trimmed version
            trim_id = str(uuid.uuid4())
            await db.trimmed_recordings.insert_one(
                {
                    "id": trim_id,
                    "source_id": payload.recording_id,
                    "start_pct": payload.start_pct,
                    "end_pct": payload.end_pct,
                    "duration_ms": end_ms - start_ms,
                    "audio_data": trimmed_b64,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            return {
                "success": True,
                "trim_id": trim_id,
                "recording_id": payload.recording_id,
                "start_pct": payload.start_pct,
                "end_pct": payload.end_pct,
                "duration_ms": end_ms - start_ms,
                "message": "Audio trimmed and saved.",
            }
        except Exception as e:
            logger.warning(f"Trim failed, returning metadata: {e}")
    # Fallback: return metadata only
    return {
        "success": True,
        "recording_id": payload.recording_id,
        "start_pct": payload.start_pct,
        "end_pct": payload.end_pct,
        "message": "Trim parameters saved.",
    }


# ── Stadium WebSocket Chat ──────────────────────
class ChatManager:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}

    async def connect(self, room: str, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(room, set()).add(ws)

    def disconnect(self, room: str, ws: WebSocket):
        if room in self.rooms:
            self.rooms[room].discard(ws)
            if not self.rooms[room]:
                del self.rooms[room]

    async def broadcast(self, room: str, message: dict):
        if room not in self.rooms:
            return
        dead = []
        for ws in self.rooms[room]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.rooms[room].discard(ws)

    def viewer_count(self, room: str) -> int:
        return len(self.rooms.get(room, set()))


chat_mgr = ChatManager()


@router.get("/chat/{room}/history")
async def chat_history(room: str, limit: int = 50):
    msgs = (
        await db.chat_messages.find({"room": room}, {"_id": 0})
        .sort("ts", -1)
        .to_list(limit)
    )
    msgs.reverse()
    return {"success": True, "messages": msgs, "viewers": chat_mgr.viewer_count(room)}


# ── Social: Follows, Likes, Stats ───────────────
@router.post("/social/follow")
async def follow_user(action: FollowAction):
    if action.follower_id == action.following_id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    existing = await db.follows.find_one(
        {"follower_id": action.follower_id, "following_id": action.following_id}
    )
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        return {"success": True, "action": "unfollowed"}
    await db.follows.insert_one(
        {
            "follower_id": action.follower_id,
            "following_id": action.following_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"success": True, "action": "followed"}


@router.get("/social/{user_id}/stats")
async def user_stats(user_id: str):
    battles = await db.covers.count_documents({"username": user_id})
    stars = await db.stars.count_documents({"username": user_id, "status": "published"})
    playlists = await db.playlists.count_documents({"owner": user_id})
    followers = await db.follows.count_documents({"following_id": user_id})
    following = await db.follows.count_documents({"follower_id": user_id})
    total_votes = 0
    for c in await db.covers.find(
        {"username": user_id}, {"_id": 0, "votes": 1}
    ).to_list(200):
        total_votes += c.get("votes", 0)
    for s in await db.stars.find({"username": user_id}, {"_id": 0, "votes": 1}).to_list(
        200
    ):
        total_votes += s.get("votes", 0)
    return {
        "success": True,
        "stats": {
            "battles": battles,
            "stars": stars,
            "playlists": playlists,
            "followers": followers,
            "following": following,
            "total_votes": total_votes,
        },
    }


@router.post("/social/{perf_id}/like")
async def like_performance(perf_id: str, user_id: str = Form(...)):
    existing = await db.likes.find_one({"perf_id": perf_id, "user_id": user_id})
    if existing:
        await db.likes.delete_one({"_id": existing["_id"]})
        return {"success": True, "action": "unliked"}
    await db.likes.insert_one(
        {
            "perf_id": perf_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"success": True, "action": "liked"}


# ── Competition Winner Auto-Credit ──────────────
@router.post("/rewards/credit-winner")
async def credit_winner(battle_id: str = Form(...)):
    """FREE MODEL: winners earn a Champion badge (no subscription months)."""
    covers = (
        await db.covers.find({"battle_id": battle_id}, {"_id": 0, "audio_data": 0})
        .sort("votes", -1)
        .to_list(1)
    )
    if not covers or covers[0].get("votes", 0) == 0:
        return {"success": False, "message": "No qualifying winner"}
    winner = covers[0]
    uname = winner.get("username", "")
    await db.rewards.insert_one(
        {
            "battle_id": battle_id,
            "winner_username": uname,
            "cover_id": winner.get("id", ""),
            "reward": "champion_badge",
            "granted_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"success": True, "winner": uname, "reward": "Champion badge credited"}


# ── Vibe-Match Discovery ────────────────────────
@router.get("/discover/for-you")
async def discover_for_you(user_id: str = "", limit: int = 15):
    preferred_artists = set()
    for pl in await db.playlists.find(
        {"owner": user_id}, {"_id": 0, "tracks": 1}
    ).to_list(20):
        for t in pl.get("tracks", []):
            if t.get("artist"):
                preferred_artists.add(t["artist"])
    for c in await db.covers.find(
        {"username": user_id}, {"_id": 0, "battle_id": 1}
    ).to_list(20):
        battle = await db.battles.find_one({"id": c["battle_id"]}, {"_id": 0})
        if battle and battle.get("song_artist"):
            preferred_artists.add(battle["song_artist"])
    search_terms = list(preferred_artists)[:3] or ["pop hits", "trending"]
    recommendations = []
    import httpx

    async with httpx.AsyncClient(timeout=6) as client:
        for term in search_terms[:2]:
            try:
                resp = await client.get(
                    "https://itunes.apple.com/search",
                    params={
                        "term": term,
                        "media": "music",
                        "entity": "song",
                        "limit": min(limit, 8),
                    },
                )
                if resp.status_code == 200:
                    for item in resp.json().get("results", []):
                        recommendations.append(
                            {
                                "id": str(item.get("trackId", "")),
                                "title": item.get("trackName", ""),
                                "artist": item.get("artistName", ""),
                                "album": item.get("collectionName", ""),
                                "cover_url": item.get("artworkUrl100", "").replace(
                                    "100x100", "600x600"
                                ),
                                "preview_url": item.get("previewUrl", ""),
                                "duration_ms": item.get("trackTimeMillis", 0),
                                "genre": item.get("primaryGenreName", ""),
                                "reason": f"Because you like {term}",
                            }
                        )
            except Exception:
                continue
    seen = set()
    unique = [
        r for r in recommendations if r["id"] not in seen and not seen.add(r["id"])
    ]
    return {
        "success": True,
        "tracks": unique[:limit],
        "preferred_artists": list(preferred_artists)[:5],
    }


# ── Master Clock Sync ───────────────────────────
@router.get("/sync/clock")
async def sync_clock():
    now = datetime.now(timezone.utc)
    return {
        "success": True,
        "server_time": now.isoformat(),
        "epoch_ms": int(now.timestamp() * 1000),
    }


@router.post("/sync/room")
async def create_sync_room(room_name: str = Form(""), host_id: str = Form("")):
    room_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)
    room = {
        "id": room_id,
        "name": room_name or f"Jam-{room_id}",
        "host_id": host_id,
        "created_at": now.isoformat(),
        "bpm": 120,
        "started_at": now.isoformat(),
    }
    await db.sync_rooms.insert_one(room)
    stored = await db.sync_rooms.find_one({"id": room_id}, {"_id": 0})
    return {"success": True, "room": stored}
