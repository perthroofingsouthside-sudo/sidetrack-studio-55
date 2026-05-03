"""iTunes music streaming: search, top songs, albums, artist, album lookup."""
from fastapi import APIRouter, HTTPException
import requests
from config import DAILY_SKIP_LIMIT
from database import db
from datetime import datetime, timezone

router = APIRouter()


@router.get("/skips/{user_id}")
async def get_skip_count(user_id: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.skip_counters.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    if not record:
        return {"success": True, "user_id": user_id, "skips_used": 0, "skips_remaining": DAILY_SKIP_LIMIT, "limit": DAILY_SKIP_LIMIT, "date": today}
    used = record.get("skips_used", 0)
    return {"success": True, "user_id": user_id, "skips_used": used, "skips_remaining": max(0, DAILY_SKIP_LIMIT - used), "limit": DAILY_SKIP_LIMIT, "date": today}


@router.post("/skips/{user_id}/use")
async def use_skip(user_id: str):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.skip_counters.find_one({"user_id": user_id, "date": today})
    used = record.get("skips_used", 0) if record else 0
    if used >= DAILY_SKIP_LIMIT:
        raise HTTPException(status_code=429, detail="Daily skip limit reached")
    await db.skip_counters.update_one(
        {"user_id": user_id, "date": today},
        {"$inc": {"skips_used": 1}, "$setOnInsert": {"user_id": user_id, "date": today}},
        upsert=True
    )
    new_used = used + 1
    return {"success": True, "skips_used": new_used, "skips_remaining": max(0, DAILY_SKIP_LIMIT - new_used), "limit": DAILY_SKIP_LIMIT}


def _itunes_track(item):
    return {
        "id": str(item.get("trackId", "")), "title": item.get("trackName", ""), "artist": item.get("artistName", ""),
        "album": item.get("collectionName", ""), "cover_url": item.get("artworkUrl100", "").replace("100x100", "600x600"),
        "cover_thumb": item.get("artworkUrl60", ""), "preview_url": item.get("previewUrl", ""),
        "duration_ms": item.get("trackTimeMillis", 0), "genre": item.get("primaryGenreName", ""),
        "release_date": item.get("releaseDate", ""), "artist_id": str(item.get("artistId", "")),
        "album_id": str(item.get("collectionId", "")),
    }


@router.get("/music/search")
async def music_search(q: str, limit: int = 20):
    resp = requests.get("https://itunes.apple.com/search", params={"term": q, "media": "music", "entity": "song", "limit": limit}, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Search failed")
    tracks = [_itunes_track(item) for item in resp.json().get("results", [])]
    return {"success": True, "tracks": tracks, "count": len(tracks)}


@router.get("/music/top-songs")
async def music_top_songs(genre: str = "", limit: int = 20):
    url = f"https://itunes.apple.com/us/rss/topsongs/limit={limit}"
    if genre:
        url += f"/genre={genre}"
    url += "/json"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch top songs")
    entries = resp.json().get("feed", {}).get("entry", [])
    tracks = []
    for item in entries:
        img_list = item.get("im:image", [])
        cover = img_list[-1].get("label", "") if img_list else ""
        tracks.append({
            "id": item.get("id", {}).get("attributes", {}).get("im:id", ""),
            "title": item.get("im:name", {}).get("label", ""),
            "artist": item.get("im:artist", {}).get("label", ""),
            "album": item.get("im:collection", {}).get("im:name", {}).get("label", "") if item.get("im:collection") else "",
            "cover_url": cover.replace("170x170", "600x600"), "cover_thumb": cover, "preview_url": "",
            "genre": item.get("category", {}).get("attributes", {}).get("label", ""),
            "release_date": item.get("im:releaseDate", {}).get("label", ""),
        })
    return {"success": True, "tracks": tracks, "count": len(tracks)}


@router.get("/music/top-albums")
async def music_top_albums(limit: int = 20):
    resp = requests.get(f"https://itunes.apple.com/us/rss/topalbums/limit={limit}/json", timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch top albums")
    entries = resp.json().get("feed", {}).get("entry", [])
    albums = []
    for item in entries:
        img_list = item.get("im:image", [])
        cover = img_list[-1].get("label", "") if img_list else ""
        albums.append({
            "id": item.get("id", {}).get("attributes", {}).get("im:id", ""),
            "name": item.get("im:name", {}).get("label", ""), "artist": item.get("im:artist", {}).get("label", ""),
            "cover_url": cover.replace("170x170", "600x600"), "cover_thumb": cover,
            "genre": item.get("category", {}).get("attributes", {}).get("label", ""),
            "release_date": item.get("im:releaseDate", {}).get("label", ""),
            "link": item.get("link", {}).get("attributes", {}).get("href", ""),
        })
    return {"success": True, "albums": albums, "count": len(albums)}


@router.get("/music/artist/{artist_id}")
async def music_artist(artist_id: str, limit: int = 10):
    resp = requests.get("https://itunes.apple.com/lookup", params={"id": artist_id, "entity": "song", "limit": limit}, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Artist lookup failed")
    results = resp.json().get("results", [])
    artist_info = results[0] if results else {}
    songs = [{"id": str(i.get("trackId", "")), "title": i.get("trackName", ""), "artist": i.get("artistName", ""),
        "album": i.get("collectionName", ""), "cover_url": i.get("artworkUrl100", "").replace("100x100", "600x600"),
        "preview_url": i.get("previewUrl", ""), "duration_ms": i.get("trackTimeMillis", 0)}
        for i in results[1:] if i.get("wrapperType") == "track"]
    return {"success": True, "artist": {"id": str(artist_info.get("artistId", "")), "name": artist_info.get("artistName", ""),
        "genre": artist_info.get("primaryGenreName", "")}, "songs": songs}


@router.get("/music/album/{album_id}")
async def music_album(album_id: str):
    resp = requests.get("https://itunes.apple.com/lookup", params={"id": album_id, "entity": "song"}, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Album lookup failed")
    results = resp.json().get("results", [])
    album_info = results[0] if results else {}
    tracks = [{"id": str(i.get("trackId", "")), "title": i.get("trackName", ""), "artist": i.get("artistName", ""),
        "preview_url": i.get("previewUrl", ""), "duration_ms": i.get("trackTimeMillis", 0), "track_number": i.get("trackNumber", 0)}
        for i in results[1:] if i.get("wrapperType") == "track"]
    return {"success": True, "album": {"id": str(album_info.get("collectionId", "")), "name": album_info.get("collectionName", ""),
        "artist": album_info.get("artistName", ""), "cover_url": album_info.get("artworkUrl100", "").replace("100x100", "600x600"),
        "genre": album_info.get("primaryGenreName", ""), "track_count": album_info.get("trackCount", 0)}, "tracks": tracks}
