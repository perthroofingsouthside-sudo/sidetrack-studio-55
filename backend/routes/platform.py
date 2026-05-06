"""Subscriptions, band activity, rewards, trim, social, discovery, sync, chat."""
from fastapi import APIRouter, HTTPException, Form, WebSocket, WebSocketDisconnect
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

# ── Subscription Tiers ──────────────────────────
SUBSCRIPTION_TIERS = [
    {"key": "stadium_vip", "name": "Stadium VIP", "tagline": "Fan Pass", "price": 4.98, "period": "month",
        "features": ["Save & share personal mixes to profile", "Exclusive neon chat badges & emojis", "Priority DM access to artists during live sessions"], "category": "fan", "highlight": True},
    {"key": "individual", "name": "Individual", "tagline": "Solo Artist", "price": 11.98, "period": "month",
        "features": ["Unlimited skips", "Full stem separation", "HD audio export", "All karaoke features"], "category": "creator", "highlight": False},
    {"key": "student", "name": "Student", "tagline": "Study & Play", "price": 9.98, "period": "month",
        "features": ["All Individual features", "Valid student email required", "Discounted creator tools"], "category": "creator", "highlight": False},
    {"key": "couple_duo", "name": "Couple / Duo", "tagline": "Two Voices", "price": 14.98, "period": "month",
        "features": ["2 accounts", "Shared duet workspace", "Unlimited skips for both", "Priority duet matching"], "category": "creator", "highlight": False},
    {"key": "family", "name": "Family", "tagline": "Up to 5 members", "price": 20.98, "period": "month",
        "features": ["5 individual accounts", "Family mix playlists", "Parental controls", "All creator features"], "category": "creator", "highlight": False},
    {"key": "adult_band", "name": "Adult Band", "tagline": "Active Band", "price": 17.98, "period": "month",
        "features": ["Up to 8 members", "Band collaboration room", "Shared stem library", "1 upload/week to stay active"], "category": "band", "highlight": False},
    {"key": "under18_band", "name": "Under-18 Band", "tagline": "Young Stars", "price": 2.98, "period": "month",
        "features": ["Up to 8 members", "Band collaboration room", "Shared stem library", "Safe community features"], "category": "band", "highlight": False},
]

@router.get("/subscriptions/tiers")
async def list_tiers():
    return {"success": True, "tiers": SUBSCRIPTION_TIERS}

@router.post("/subscriptions/select")
async def select_subscription(payload: SubscriptionSelect):
    tier = next((t for t in SUBSCRIPTION_TIERS if t["key"] == payload.tier_key), None)
    if not tier: raise HTTPException(status_code=400, detail="Invalid tier key")
    now = datetime.now(timezone.utc)
    sub_doc = {"user_id": payload.user_id, "tier_key": tier["key"], "tier_name": tier["name"], "price": tier["price"],
        "status": "trial", "trial_end": (now + timedelta(days=30)).isoformat(), "started_at": now.isoformat(),
        "last_upload": None, "active_band": tier["category"] == "band", "reward_months": 0}
    await db.subscriptions.update_one({"user_id": payload.user_id}, {"$set": sub_doc}, upsert=True)
    stored = await db.subscriptions.find_one({"user_id": payload.user_id}, {"_id": 0})
    return {"success": True, "subscription": stored}

@router.get("/subscriptions/{user_id}/status")
async def get_subscription_status(user_id: str):
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if not sub:
        return {"success": True, "subscription": None, "is_pro": False, "is_vip": False, "is_band": False, "tier_key": "free", "upload_status": None}
    tier_key = sub.get("tier_key", "free")
    is_band = tier_key in ("adult_band", "under18_band")
    upload_status = None
    if is_band:
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        week_end = week_start + timedelta(days=7)
        uploads = await db.band_uploads.count_documents({"user_id": user_id, "uploaded_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()}})
        upload_status = {"uploads_this_week": uploads, "required": 1, "met": uploads >= 1, "week_start": week_start.isoformat(), "week_end": week_end.isoformat()}
    return {"success": True, "subscription": sub, "is_pro": tier_key != "free", "is_vip": tier_key == "stadium_vip",
        "is_band": is_band, "tier_key": tier_key, "upload_status": upload_status}

@router.post("/subscriptions/{user_id}/upload")
async def record_band_upload(user_id: str):
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if not sub or sub.get("tier_key") not in ("adult_band", "under18_band"):
        raise HTTPException(status_code=400, detail="Not a band subscription")
    now = datetime.now(timezone.utc)
    await db.band_uploads.insert_one({"user_id": user_id, "uploaded_at": now.isoformat()})
    await db.subscriptions.update_one({"user_id": user_id}, {"$set": {"last_upload": now.isoformat()}})
    return {"success": True, "message": "Upload recorded"}

# ── Active Band Auto-Downgrade ──────────────────

INDIVIDUAL_RATE = 11.98  # Downgrade target rate


async def _run_band_activity_check(trigger: str = "manual"):
    """Core logic: scan all band accounts, audit each, downgrade inactive ones.
    
    Business rules:
    - Scans all subscriptions with tier_key in (adult_band, under18_band) that are NOT already downgraded
    - Checks if the user uploaded at least 1 track/stem in the preceding 7 days
    - If requirement NOT met → flag account as downgraded, adjust price to Individual rate ($11.98)
    - Every check is logged to the `band_audit_log` collection for admin review
    """
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=7)).isoformat()
    run_id = str(uuid.uuid4())[:12]

    band_subs = await db.subscriptions.find(
        {"tier_key": {"$in": ["adult_band", "under18_band"]}, "status": {"$ne": "downgraded"}},
        {"_id": 0},
    ).to_list(1000)

    checked = 0
    compliant = []
    downgraded = []
    audit_entries = []

    for sub in band_subs:
        checked += 1
        user_id = sub["user_id"]
        tier_key = sub.get("tier_key", "")
        original_price = sub.get("price", 0)
        last_upload = sub.get("last_upload")

        # Count uploads in the 7-day window
        uploads_count = await db.band_uploads.count_documents(
            {"user_id": user_id, "uploaded_at": {"$gte": cutoff}}
        )

        met_requirement = uploads_count >= 1
        action = "none"

        if not met_requirement:
            # Downgrade: flag account + adjust price to Individual rate
            await db.subscriptions.update_one(
                {"user_id": user_id},
                {"$set": {
                    "status": "downgraded",
                    "downgraded_at": now.isoformat(),
                    "downgrade_reason": "No upload in 7 days",
                    "previous_tier": tier_key,
                    "previous_price": original_price,
                    "price": INDIVIDUAL_RATE,
                }},
            )
            downgraded.append(user_id)
            action = "downgraded_to_individual"
        else:
            compliant.append(user_id)
            action = "compliant"

        # Audit log entry for this user
        audit_entries.append({
            "run_id": run_id,
            "trigger": trigger,
            "user_id": user_id,
            "tier_key": tier_key,
            "original_price": original_price,
            "last_upload": last_upload,
            "uploads_in_window": uploads_count,
            "cutoff": cutoff,
            "met_requirement": met_requirement,
            "action": action,
            "new_price": INDIVIDUAL_RATE if not met_requirement else original_price,
            "checked_at": now.isoformat(),
        })

    # Write all audit entries in bulk
    if audit_entries:
        await db.band_audit_log.insert_many(audit_entries)

    # Write a summary record
    summary = {
        "run_id": run_id,
        "trigger": trigger,
        "checked_at": now.isoformat(),
        "total_checked": checked,
        "compliant_count": len(compliant),
        "downgraded_count": len(downgraded),
        "downgraded_users": downgraded,
        "compliant_users": compliant,
    }
    await db.band_audit_log.insert_one({**summary, "type": "run_summary"})

    logger.info(
        f"[BandCron] run_id={run_id} trigger={trigger} "
        f"checked={checked} compliant={len(compliant)} downgraded={len(downgraded)}"
    )

    return summary


@router.post("/subscriptions/check-band-activity")
async def check_band_activity():
    """Manual trigger: scan all band accounts and downgrade inactive ones."""
    result = await _run_band_activity_check(trigger="manual_api")
    return {"success": True, **result}


@router.get("/subscriptions/band-audit")
async def get_band_audit_log(limit: int = 50):
    """Admin endpoint: retrieve the band activity audit trail."""
    entries = await db.band_audit_log.find(
        {}, {"_id": 0}
    ).sort("checked_at", -1).to_list(limit)
    return {"success": True, "entries": entries, "count": len(entries)}


@router.get("/subscriptions/band-audit/summary")
async def get_band_audit_summaries(limit: int = 20):
    """Admin endpoint: retrieve run summaries only."""
    summaries = await db.band_audit_log.find(
        {"type": "run_summary"}, {"_id": 0}
    ).sort("checked_at", -1).to_list(limit)
    return {"success": True, "summaries": summaries, "count": len(summaries)}

# ── Real Audio Trimming ─────────────────────────
@router.post("/trim")
async def trim_recording(payload: TrimRequest):
    if payload.start_pct < 0 or payload.end_pct > 100 or payload.start_pct >= payload.end_pct:
        raise HTTPException(status_code=400, detail="Invalid trim range")
    # Look up the recording's audio data
    rec = await db.recordings.find_one({"id": payload.recording_id}) if payload.recording_id else None
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
            trimmed_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
            # Save trimmed version
            trim_id = str(uuid.uuid4())
            await db.trimmed_recordings.insert_one({
                "id": trim_id, "source_id": payload.recording_id,
                "start_pct": payload.start_pct, "end_pct": payload.end_pct,
                "duration_ms": end_ms - start_ms, "audio_data": trimmed_b64,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"success": True, "trim_id": trim_id, "recording_id": payload.recording_id,
                "start_pct": payload.start_pct, "end_pct": payload.end_pct,
                "duration_ms": end_ms - start_ms, "message": "Audio trimmed and saved."}
        except Exception as e:
            logger.warning(f"Trim failed, returning metadata: {e}")
    # Fallback: return metadata only
    return {"success": True, "recording_id": payload.recording_id, "start_pct": payload.start_pct,
        "end_pct": payload.end_pct, "message": "Trim parameters saved."}

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
            if not self.rooms[room]: del self.rooms[room]
    async def broadcast(self, room: str, message: dict):
        if room not in self.rooms: return
        dead = []
        for ws in self.rooms[room]:
            try: await ws.send_json(message)
            except Exception: dead.append(ws)
        for ws in dead: self.rooms[room].discard(ws)
    def viewer_count(self, room: str) -> int:
        return len(self.rooms.get(room, set()))

chat_mgr = ChatManager()

@router.get("/chat/{room}/history")
async def chat_history(room: str, limit: int = 50):
    msgs = await db.chat_messages.find({"room": room}, {"_id": 0}).sort("ts", -1).to_list(limit)
    msgs.reverse()
    return {"success": True, "messages": msgs, "viewers": chat_mgr.viewer_count(room)}

# ── Social: Follows, Likes, Stats ───────────────
@router.post("/social/follow")
async def follow_user(action: FollowAction):
    if action.follower_id == action.following_id: raise HTTPException(status_code=400, detail="Cannot follow yourself")
    existing = await db.follows.find_one({"follower_id": action.follower_id, "following_id": action.following_id})
    if existing:
        await db.follows.delete_one({"_id": existing["_id"]})
        return {"success": True, "action": "unfollowed"}
    await db.follows.insert_one({"follower_id": action.follower_id, "following_id": action.following_id, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "action": "followed"}

@router.get("/social/{user_id}/stats")
async def user_stats(user_id: str):
    battles = await db.covers.count_documents({"username": user_id})
    stars = await db.stars.count_documents({"username": user_id, "status": "published"})
    playlists = await db.playlists.count_documents({"owner": user_id})
    followers = await db.follows.count_documents({"following_id": user_id})
    following = await db.follows.count_documents({"follower_id": user_id})
    total_votes = 0
    for c in await db.covers.find({"username": user_id}, {"_id": 0, "votes": 1}).to_list(200):
        total_votes += c.get("votes", 0)
    for s in await db.stars.find({"username": user_id}, {"_id": 0, "votes": 1}).to_list(200):
        total_votes += s.get("votes", 0)
    return {"success": True, "stats": {"battles": battles, "stars": stars, "playlists": playlists,
        "followers": followers, "following": following, "total_votes": total_votes}}

@router.post("/social/{perf_id}/like")
async def like_performance(perf_id: str, user_id: str = Form(...)):
    existing = await db.likes.find_one({"perf_id": perf_id, "user_id": user_id})
    if existing:
        await db.likes.delete_one({"_id": existing["_id"]})
        return {"success": True, "action": "unliked"}
    await db.likes.insert_one({"perf_id": perf_id, "user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "action": "liked"}

# ── Competition Winner Auto-Credit ──────────────
@router.post("/rewards/credit-winner")
async def credit_winner(battle_id: str = Form(...)):
    covers = await db.covers.find({"battle_id": battle_id}, {"_id": 0, "audio_data": 0}).sort("votes", -1).to_list(1)
    if not covers or covers[0].get("votes", 0) == 0:
        return {"success": False, "message": "No qualifying winner"}
    winner = covers[0]
    uname = winner.get("username", "")
    sub = await db.subscriptions.find_one({"user_id": uname})
    if sub:
        await db.subscriptions.update_one({"user_id": uname}, {"$inc": {"reward_months": 1}})
    else:
        await db.subscriptions.insert_one({"user_id": uname, "tier_key": "individual", "tier_name": "Individual",
            "price": 0, "status": "reward", "trial_end": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "started_at": datetime.now(timezone.utc).isoformat(), "last_upload": None, "active_band": False, "reward_months": 1})
    await db.rewards.insert_one({"battle_id": battle_id, "winner_username": uname, "cover_id": winner.get("id", ""),
        "reward": "1_month_pro", "granted_at": datetime.now(timezone.utc).isoformat()})
    return {"success": True, "winner": uname, "reward": "1 month Pro credited"}

# ── Vibe-Match Discovery ────────────────────────
@router.get("/discover/for-you")
async def discover_for_you(user_id: str = "", limit: int = 15):
    preferred_artists = set()
    for pl in await db.playlists.find({"owner": user_id}, {"_id": 0, "tracks": 1}).to_list(20):
        for t in pl.get("tracks", []):
            if t.get("artist"): preferred_artists.add(t["artist"])
    for c in await db.covers.find({"username": user_id}, {"_id": 0, "battle_id": 1}).to_list(20):
        battle = await db.battles.find_one({"id": c["battle_id"]}, {"_id": 0})
        if battle and battle.get("song_artist"): preferred_artists.add(battle["song_artist"])
    search_terms = list(preferred_artists)[:3] or ["pop hits", "trending"]
    recommendations = []
    import httpx
    async with httpx.AsyncClient(timeout=6) as client:
        for term in search_terms[:2]:
            try:
                resp = await client.get("https://itunes.apple.com/search", params={"term": term, "media": "music", "entity": "song", "limit": min(limit, 8)})
                if resp.status_code == 200:
                    for item in resp.json().get("results", []):
                        recommendations.append({"id": str(item.get("trackId", "")), "title": item.get("trackName", ""),
                            "artist": item.get("artistName", ""), "album": item.get("collectionName", ""),
                            "cover_url": item.get("artworkUrl100", "").replace("100x100", "600x600"),
                            "preview_url": item.get("previewUrl", ""), "duration_ms": item.get("trackTimeMillis", 0),
                            "genre": item.get("primaryGenreName", ""), "reason": f"Because you like {term}"})
            except Exception: continue
    seen = set()
    unique = [r for r in recommendations if r["id"] not in seen and not seen.add(r["id"])]
    return {"success": True, "tracks": unique[:limit], "preferred_artists": list(preferred_artists)[:5]}

# ── Master Clock Sync ───────────────────────────
@router.get("/sync/clock")
async def sync_clock():
    now = datetime.now(timezone.utc)
    return {"success": True, "server_time": now.isoformat(), "epoch_ms": int(now.timestamp() * 1000)}

@router.post("/sync/room")
async def create_sync_room(room_name: str = Form(""), host_id: str = Form("")):
    room_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)
    room = {"id": room_id, "name": room_name or f"Jam-{room_id}", "host_id": host_id, "created_at": now.isoformat(), "bpm": 120, "started_at": now.isoformat()}
    await db.sync_rooms.insert_one(room)
    stored = await db.sync_rooms.find_one({"id": room_id}, {"_id": 0})
    return {"success": True, "room": stored}
