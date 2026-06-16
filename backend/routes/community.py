"""Cover Battles, Playlists, Duets, Stars, Challenges."""

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from database import db
from models import (
    Battle,
    BattleCreate,
    Cover,
    Playlist,
    PlaylistCreate,
    PlaylistAddTrack,
    DuetRecord,
    StarPerformance,
)
import base64
import uuid
from datetime import datetime, timezone, timedelta
from typing import List

router = APIRouter()

# --- Cover Battles ---


@router.post("/battles")
async def create_battle(battle: BattleCreate):
    b = Battle(**battle.model_dump())
    await db.battles.insert_one(b.model_dump())
    stored = await db.battles.find_one({"id": b.id}, {"_id": 0})
    return {"success": True, "battle": stored}


@router.get("/battles")
async def list_battles(status: str = "active", limit: int = 20):
    query = {"status": status} if status else {}
    battles = (
        await db.battles.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    )
    return {"success": True, "battles": battles}


@router.get("/battles/{battle_id}")
async def get_battle(battle_id: str):
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    covers = (
        await db.covers.find({"battle_id": battle_id}, {"_id": 0, "audio_data": 0})
        .sort("votes", -1)
        .to_list(100)
    )
    return {"success": True, "battle": battle, "covers": covers}


@router.post("/battles/{battle_id}/submit")
async def submit_cover(
    battle_id: str,
    username: str = Form(...),
    title: str = Form(""),
    file: UploadFile = File(...),
):
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.get("status") != "active":
        raise HTTPException(status_code=400, detail="Battle is no longer active")
    audio_b64 = base64.b64encode(await file.read()).decode("utf-8")
    cover = Cover(
        battle_id=battle_id,
        username=username,
        title=title or f"{username}'s Cover",
        audio_data=audio_b64,
    )
    await db.covers.insert_one(cover.model_dump())
    await db.battles.update_one({"id": battle_id}, {"$inc": {"cover_count": 1}})
    stored = await db.covers.find_one({"id": cover.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "cover": stored}


@router.post("/battles/{battle_id}/vote/{cover_id}")
async def vote_cover(battle_id: str, cover_id: str, voter_id: str = Form(...)):
    cover = await db.covers.find_one({"id": cover_id, "battle_id": battle_id})
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")
    if voter_id in cover.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted")
    await db.covers.update_one(
        {"id": cover_id}, {"$inc": {"votes": 1}, "$push": {"voters": voter_id}}
    )
    updated = await db.covers.find_one({"id": cover_id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "cover": updated}


@router.get("/battles/{battle_id}/cover/{cover_id}/audio")
async def get_cover_audio(battle_id: str, cover_id: str):
    cover = await db.covers.find_one(
        {"id": cover_id, "battle_id": battle_id}, {"_id": 0}
    )
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")
    return {"success": True, "audio_data": cover.get("audio_data", "")}


@router.get("/battles/leaderboard/top")
async def battle_leaderboard(limit: int = 20):
    pipeline = [
        {"$project": {"_id": 0, "audio_data": 0}},
        {"$sort": {"votes": -1}},
        {"$limit": limit},
    ]
    top_covers = await db.covers.aggregate(pipeline).to_list(limit)
    for cover in top_covers:
        battle = await db.battles.find_one({"id": cover.get("battle_id")}, {"_id": 0})
        if battle:
            cover["song_title"] = battle.get("song_title", "")
            cover["song_artist"] = battle.get("song_artist", "")
            cover["song_cover_url"] = battle.get("song_cover_url", "")
    return {"success": True, "leaderboard": top_covers}


# --- Playlists ---


@router.post("/playlists")
async def create_playlist(playlist: PlaylistCreate):
    pl = Playlist(**playlist.model_dump())
    await db.playlists.insert_one(pl.model_dump())
    stored = await db.playlists.find_one({"id": pl.id}, {"_id": 0})
    return {"success": True, "playlist": stored}


@router.get("/playlists")
async def list_playlists(owner: str = "", public_only: bool = False):
    query = {}
    if owner:
        query["owner"] = owner
    if public_only:
        query["is_public"] = True
    playlists = (
        await db.playlists.find(query, {"_id": 0, "tracks": 0})
        .sort("created_at", -1)
        .to_list(50)
    )
    return {"success": True, "playlists": playlists}


@router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str):
    pl = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"success": True, "playlist": pl}


@router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(playlist_id: str, track: PlaylistAddTrack):
    pl = await db.playlists.find_one({"id": playlist_id})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    track_doc = track.model_dump()
    track_doc["added_at"] = datetime.now(timezone.utc).isoformat()
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$push": {"tracks": track_doc}, "$inc": {"track_count": 1}},
    )
    if not pl.get("cover_url") and track.cover_url:
        await db.playlists.update_one(
            {"id": playlist_id}, {"$set": {"cover_url": track.cover_url}}
        )
    stored = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    return {"success": True, "playlist": stored}


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track(playlist_id: str, track_id: str):
    result = await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"tracks": {"track_id": track_id}}, "$inc": {"track_count": -1}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Track not found in playlist")
    return {"success": True, "message": "Track removed"}


@router.put("/playlists/{playlist_id}")
async def update_playlist(
    playlist_id: str, name: str = Form(""), is_public: bool = Form(True)
):
    update = {"is_public": is_public}
    if name:
        update["name"] = name
    result = await db.playlists.update_one({"id": playlist_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    stored = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "tracks": 0})
    return {"success": True, "playlist": stored}


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str):
    result = await db.playlists.delete_one({"id": playlist_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"success": True, "message": "Playlist deleted"}


# --- Duets ---


@router.post("/duets")
async def create_duet(
    username: str = Form(...),
    battle_id: str = Form(...),
    cover_id: str = Form(...),
    title: str = Form(""),
    file: UploadFile = File(...),
):
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    cover = await db.covers.find_one(
        {"id": cover_id, "battle_id": battle_id}, {"_id": 0, "audio_data": 0}
    )
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")
    audio_b64 = base64.b64encode(await file.read()).decode("utf-8")
    duet = DuetRecord(
        battle_id=battle_id,
        cover_id=cover_id,
        username=username,
        partner_username=cover.get("username", ""),
        title=title or f"{username} x {cover.get('username', 'Unknown')} Duet",
        audio_data=audio_b64,
        song_title=battle.get("song_title", ""),
        song_artist=battle.get("song_artist", ""),
        song_cover_url=battle.get("song_cover_url", ""),
    )
    await db.duets.insert_one(duet.model_dump())
    stored = await db.duets.find_one({"id": duet.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "duet": stored}


@router.get("/duets")
async def list_duets(username: str = "", limit: int = 20):
    query = {"username": username} if username else {}
    duets = (
        await db.duets.find(query, {"_id": 0, "audio_data": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return {"success": True, "duets": duets}


@router.get("/duets/{duet_id}")
async def get_duet(duet_id: str):
    duet = await db.duets.find_one({"id": duet_id}, {"_id": 0, "audio_data": 0})
    if not duet:
        raise HTTPException(status_code=404, detail="Duet not found")
    return {"success": True, "duet": duet}


@router.get("/duets/{duet_id}/audio")
async def get_duet_audio(duet_id: str):
    duet = await db.duets.find_one({"id": duet_id}, {"_id": 0})
    if not duet:
        raise HTTPException(status_code=404, detail="Duet not found")
    return {"success": True, "audio_data": duet.get("audio_data", "")}


# --- Stars ---


@router.post("/stars")
async def submit_star(
    username: str = Form(...),
    song_title: str = Form(""),
    song_artist: str = Form(""),
    song_cover_url: str = Form(""),
    song_id: str = Form(""),
    title: str = Form(""),
    challenge_id: str = Form(""),
    file: UploadFile = File(...),
):
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    audio_b64 = base64.b64encode(audio_bytes).decode("utf-8")
    perf = StarPerformance(
        username=username,
        song_title=song_title,
        song_artist=song_artist,
        song_cover_url=song_cover_url,
        song_id=song_id,
        title=title or f"{username} sings {song_title}",
        audio_data=audio_b64,
        challenge_id=challenge_id,
    )
    await db.stars.insert_one(perf.model_dump())
    stored = await db.stars.find_one({"id": perf.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "performance": stored}


@router.get("/stars/feed")
async def star_feed(limit: int = 30):
    performances = (
        await db.stars.find({"status": "published"}, {"_id": 0, "audio_data": 0})
        .sort("created_at", -1)
        .to_list(limit)
    )
    return {"success": True, "performances": performances}


@router.get("/stars/leaderboard")
async def star_leaderboard(limit: int = 20):
    pipeline = [
        {"$match": {"status": "published"}},
        {"$project": {"_id": 0, "audio_data": 0}},
        {"$sort": {"votes": -1}},
        {"$limit": limit},
    ]
    top = await db.stars.aggregate(pipeline).to_list(limit)
    return {"success": True, "leaderboard": top}


@router.get("/stars/{perf_id}")
async def get_star(perf_id: str):
    perf = await db.stars.find_one({"id": perf_id}, {"_id": 0, "audio_data": 0})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    return {"success": True, "performance": perf}


@router.get("/stars/{perf_id}/audio")
async def get_star_audio(perf_id: str):
    perf = await db.stars.find_one({"id": perf_id}, {"_id": 0})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    return {"success": True, "audio_data": perf.get("audio_data", "")}


@router.post("/stars/{perf_id}/vote")
async def vote_star(perf_id: str, voter_id: str = Form(...)):
    perf = await db.stars.find_one({"id": perf_id})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    if voter_id in perf.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted")
    await db.stars.update_one(
        {"id": perf_id}, {"$inc": {"votes": 1}, "$push": {"voters": voter_id}}
    )
    updated = await db.stars.find_one({"id": perf_id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "performance": updated}


# --- Challenges ---

CHALLENGE_THEMES = [
    {
        "title": "90s Throwback",
        "desc": "Sing your favorite 90s hit!",
        "emoji": "cassette",
    },
    {
        "title": "Power Ballads",
        "desc": "Belt out the biggest ballads of all time",
        "emoji": "fire",
    },
    {
        "title": "Acoustic Vibes",
        "desc": "Strip it back — acoustic covers only",
        "emoji": "guitar",
    },
    {
        "title": "Hip-Hop Classics",
        "desc": "Spit bars from the golden era",
        "emoji": "mic",
    },
    {
        "title": "Pop Anthems",
        "desc": "Sing the catchiest pop songs ever made",
        "emoji": "star",
    },
    {"title": "Rock Legends", "desc": "Channel your inner rock god", "emoji": "guitar"},
    {
        "title": "R&B Grooves",
        "desc": "Smooth vocals and soulful melodies",
        "emoji": "music",
    },
    {
        "title": "Country Roads",
        "desc": "Twang it out — country hits only",
        "emoji": "hat",
    },
    {
        "title": "Movie Soundtracks",
        "desc": "Sing iconic songs from the silver screen",
        "emoji": "film",
    },
    {
        "title": "Freestyle Friday",
        "desc": "Anything goes — surprise us!",
        "emoji": "sparkle",
    },
    {
        "title": "Duet Anthems",
        "desc": "Songs made for two — solo or duo!",
        "emoji": "users",
    },
    {
        "title": "One-Hit Wonders",
        "desc": "Celebrate the songs that defined a moment",
        "emoji": "flash",
    },
]


def _challenge_dates():
    now = datetime.now(timezone.utc)
    days_since_wed = (now.weekday() - 2) % 7
    start = (now - timedelta(days=days_since_wed)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return start, start + timedelta(days=7)


def _week_number():
    now = datetime.now(timezone.utc)
    return (now - datetime(2025, 1, 1, tzinfo=timezone.utc)).days // 7


@router.get("/challenges/current")
async def get_current_challenge():
    start, end = _challenge_dates()
    start_iso, end_iso = start.isoformat(), end.isoformat()
    existing = await db.challenges.find_one({"start_date": start_iso}, {"_id": 0})
    if existing:
        entry_count = await db.stars.count_documents({"challenge_id": existing["id"]})
        top = (
            await db.stars.find(
                {"challenge_id": existing["id"]}, {"_id": 0, "audio_data": 0}
            )
            .sort("votes", -1)
            .to_list(1)
        )
        existing["entry_count"] = entry_count
        existing["star_of_week"] = (
            top[0] if top and top[0].get("votes", 0) > 0 else None
        )
        return {"success": True, "challenge": existing}
    week_num = _week_number()
    theme = CHALLENGE_THEMES[week_num % len(CHALLENGE_THEMES)]
    challenge = {
        "id": str(uuid.uuid4()),
        "title": theme["title"],
        "description": theme["desc"],
        "emoji": theme["emoji"],
        "start_date": start_iso,
        "end_date": end_iso,
        "week_number": week_num,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.challenges.insert_one(challenge)
    stored = await db.challenges.find_one({"id": challenge["id"]}, {"_id": 0})
    stored["entry_count"] = 0
    stored["star_of_week"] = None
    return {"success": True, "challenge": stored}


@router.get("/challenges/{challenge_id}/entries")
async def get_challenge_entries(challenge_id: str, limit: int = 30):
    challenge = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    entries = (
        await db.stars.find({"challenge_id": challenge_id}, {"_id": 0, "audio_data": 0})
        .sort("votes", -1)
        .to_list(limit)
    )
    return {"success": True, "challenge": challenge, "entries": entries}


@router.get("/challenges/history")
async def challenge_history(limit: int = 10):
    challenges = (
        await db.challenges.find({}, {"_id": 0}).sort("start_date", -1).to_list(limit)
    )
    for ch in challenges:
        top = (
            await db.stars.find({"challenge_id": ch["id"]}, {"_id": 0, "audio_data": 0})
            .sort("votes", -1)
            .to_list(1)
        )
        ch["star_of_week"] = top[0] if top and top[0].get("votes", 0) > 0 else None
        ch["entry_count"] = await db.stars.count_documents({"challenge_id": ch["id"]})
    return {"success": True, "challenges": challenges}
