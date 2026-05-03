from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form, BackgroundTasks
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import requests
import json
import tempfile
import asyncio
import replicate
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# API Keys
RAPIDAPI_KEY = os.environ.get('RAPIDAPI_KEY', '')
RAPIDAPI_HOST = os.environ.get('RAPIDAPI_HOST', 'shazam.p.rapidapi.com')
REPLICATE_API_TOKEN = os.environ.get('REPLICATE_API_TOKEN', '')

# Spotify
SPOTIFY_CLIENT_ID = os.environ.get('SPOTIFY_CLIENT_ID', '')
SPOTIFY_CLIENT_SECRET = os.environ.get('SPOTIFY_CLIENT_SECRET', '')
SPOTIFY_REDIRECT_URI = os.environ.get('SPOTIFY_REDIRECT_URI', '')

# Set Replicate API token in environment for the library
if REPLICATE_API_TOKEN:
    os.environ["REPLICATE_API_TOKEN"] = REPLICATE_API_TOKEN

DEMUCS_MODEL = "cjwbw/demucs:25a173108cff36ef9f80f854c162d01df9e6528be175794b81158fa03836d953"

# Spotify client credentials token (for search/browse without user login)
_spotify_cc_token = {"token": None, "expires": 0}

def get_spotify_client_token():
    """Get a client credentials token for non-user Spotify API calls."""
    import time
    now = time.time()
    if _spotify_cc_token["token"] and now < _spotify_cc_token["expires"]:
        return _spotify_cc_token["token"]

    if not SPOTIFY_CLIENT_ID or not SPOTIFY_CLIENT_SECRET:
        return None

    try:
        resp = requests.post(
            "https://accounts.spotify.com/api/token",
            data={"grant_type": "client_credentials"},
            auth=(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET),
            timeout=10
        )
        if resp.status_code == 200:
            data = resp.json()
            _spotify_cc_token["token"] = data["access_token"]
            _spotify_cc_token["expires"] = now + data.get("expires_in", 3600) - 60
            return data["access_token"]
    except Exception as e:
        logger.error(f"Spotify client credentials error: {e}")
    return None

# --- Models ---
class SongResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = ""
    artist: str = ""
    album: str = ""
    cover_url: str = ""
    shazam_key: str = ""
    genre: str = ""
    release_year: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class StemStatus(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    song_id: str
    status: str = "processing"
    vocals_url: str = ""
    guitar_url: str = ""
    bass_url: str = ""
    drums_url: str = ""
    original_url: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class LyricsData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    song_id: str
    lyrics: List[dict] = []
    chords: List[dict] = []

class RecordingCreate(BaseModel):
    song_id: str
    title: str = ""
    recording_type: str = "audio"
    duration: float = 0.0

class Recording(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    song_id: str
    title: str = ""
    recording_type: str = "audio"
    duration: float = 0.0
    audio_data: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# --- Cover Battle Models ---
class BattleCreate(BaseModel):
    song_title: str
    song_artist: str = ""
    song_cover_url: str = ""
    challenge_text: str = ""

# --- Playlist Models ---
class PlaylistCreate(BaseModel):
    name: str
    description: str = ""
    is_public: bool = True
    owner: str = "anonymous"

class Playlist(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    is_public: bool = True
    owner: str = "anonymous"
    tracks: List[dict] = []
    track_count: int = 0
    cover_url: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PlaylistAddTrack(BaseModel):
    track_id: str
    title: str
    artist: str = ""
    album: str = ""
    cover_url: str = ""
    preview_url: str = ""
    duration_ms: int = 0

class Battle(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    song_title: str
    song_artist: str = ""
    song_cover_url: str = ""
    challenge_text: str = ""
    status: str = "active"
    cover_count: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CoverSubmit(BaseModel):
    username: str
    title: str = ""

class Cover(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    battle_id: str
    username: str
    title: str = ""
    audio_data: str = ""
    votes: int = 0
    voters: List[str] = []
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# --- Shazam Integration ---
async def recognize_with_shazam(audio_bytes: bytes) -> Optional[dict]:
    """Send audio to Shazam API for recognition."""
    try:
        raw_audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        url = "https://shazam.p.rapidapi.com/songs/detect"
        headers = {
            "x-rapidapi-key": RAPIDAPI_KEY,
            "x-rapidapi-host": RAPIDAPI_HOST,
            "Content-Type": "text/plain"
        }
        response = requests.post(url, data=raw_audio_b64, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()

        if result.get('matches') and len(result['matches']) > 0:
            track = result.get('track', {})
            return {
                "title": track.get('title', 'Unknown'),
                "artist": track.get('subtitle', 'Unknown Artist'),
                "album": track.get('sections', [{}])[0].get('metadata', [{}])[0].get('text', '') if track.get('sections') else '',
                "cover_url": track.get('images', {}).get('coverarthq', track.get('images', {}).get('coverart', '')),
                "shazam_key": track.get('key', ''),
                "genre": track.get('genres', {}).get('primary', ''),
                "release_year": ""
            }
        return None
    except Exception as e:
        logger.error(f"Shazam API error: {e}")
        return None

# --- Mock Data Generators ---
def get_mock_lyrics(title: str, artist: str) -> dict:
    """Generate mock lyrics with chord progressions for demo."""
    return {
        "lyrics": [
            {"time": 0, "text": f"[Intro]", "type": "section"},
            {"time": 4, "text": "The lights go down, the music starts to play", "type": "line"},
            {"time": 8, "text": "A melody that takes my breath away", "type": "line"},
            {"time": 12, "text": "", "type": "break"},
            {"time": 14, "text": f"[Verse 1]", "type": "section"},
            {"time": 16, "text": "Walking through the city after dark", "type": "line"},
            {"time": 20, "text": "Every sound is music to my heart", "type": "line"},
            {"time": 24, "text": "Rhythm in the raindrops on the street", "type": "line"},
            {"time": 28, "text": "Dancing to the sound of every beat", "type": "line"},
            {"time": 32, "text": "", "type": "break"},
            {"time": 34, "text": f"[Chorus]", "type": "section"},
            {"time": 36, "text": "Turn it up, let the music set you free", "type": "line"},
            {"time": 40, "text": "Feel the bass line running through your veins", "type": "line"},
            {"time": 44, "text": "Nothing else matters when the speakers breathe", "type": "line"},
            {"time": 48, "text": "Lost in sound, forget about the pain", "type": "line"},
            {"time": 52, "text": "", "type": "break"},
            {"time": 54, "text": f"[Verse 2]", "type": "section"},
            {"time": 56, "text": "Frequencies that vibrate through the night", "type": "line"},
            {"time": 60, "text": "Every note is burning like a light", "type": "line"},
            {"time": 64, "text": "Harmonies that echo in my soul", "type": "line"},
            {"time": 68, "text": "This is where the broken become whole", "type": "line"},
            {"time": 72, "text": "", "type": "break"},
            {"time": 74, "text": f"[Bridge]", "type": "section"},
            {"time": 76, "text": "And when the world is falling down around us", "type": "line"},
            {"time": 80, "text": "We find our shelter in the sound", "type": "line"},
            {"time": 84, "text": "", "type": "break"},
            {"time": 86, "text": f"[Outro]", "type": "section"},
            {"time": 88, "text": "The music never dies...", "type": "line"},
        ],
        "chords": [
            {"time": 0, "chord": "Am", "duration": 4},
            {"time": 4, "chord": "F", "duration": 4},
            {"time": 8, "chord": "C", "duration": 4},
            {"time": 12, "chord": "G", "duration": 4},
            {"time": 16, "chord": "Am", "duration": 4},
            {"time": 20, "chord": "F", "duration": 4},
            {"time": 24, "chord": "C", "duration": 4},
            {"time": 28, "chord": "G", "duration": 4},
            {"time": 32, "chord": "Am", "duration": 2},
            {"time": 34, "chord": "Em", "duration": 2},
            {"time": 36, "chord": "F", "duration": 4},
            {"time": 40, "chord": "C", "duration": 4},
            {"time": 44, "chord": "G", "duration": 4},
            {"time": 48, "chord": "Am", "duration": 4},
            {"time": 52, "chord": "F", "duration": 2},
            {"time": 54, "chord": "G", "duration": 2},
            {"time": 56, "chord": "Am", "duration": 4},
            {"time": 60, "chord": "Dm", "duration": 4},
            {"time": 64, "chord": "F", "duration": 4},
            {"time": 68, "chord": "G", "duration": 4},
            {"time": 72, "chord": "C", "duration": 4},
            {"time": 76, "chord": "Am", "duration": 4},
            {"time": 80, "chord": "F", "duration": 4},
            {"time": 84, "chord": "G", "duration": 4},
            {"time": 88, "chord": "Am", "duration": 8},
        ]
    }

# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "SIDETRACK API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "shazam_configured": bool(RAPIDAPI_KEY)}

# --- Daily Skip Limiter ---
DAILY_SKIP_LIMIT = 50

@api_router.get("/skips/{user_id}")
async def get_skip_count(user_id: str):
    """Get remaining skips for a user. Resets at midnight UTC daily."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.skip_counters.find_one({"user_id": user_id, "date": today}, {"_id": 0})
    if not record:
        return {"success": True, "user_id": user_id, "skips_used": 0, "skips_remaining": DAILY_SKIP_LIMIT, "limit": DAILY_SKIP_LIMIT, "date": today}
    used = record.get("skips_used", 0)
    return {"success": True, "user_id": user_id, "skips_used": used, "skips_remaining": max(0, DAILY_SKIP_LIMIT - used), "limit": DAILY_SKIP_LIMIT, "date": today}

@api_router.post("/skips/{user_id}/use")
async def use_skip(user_id: str):
    """Use one skip. Returns 429 if limit reached."""
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

# Song Recognition
@api_router.post("/recognize")
async def recognize_song(file: UploadFile = File(...)):
    """Recognize a song from audio upload."""
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Try Shazam API
    result = await recognize_with_shazam(audio_bytes)

    if result:
        song = SongResult(**result)
        doc = song.model_dump()
        await db.songs.insert_one(doc)
        stored = await db.songs.find_one({"id": song.id}, {"_id": 0})
        return {"success": True, "song": stored}
    else:
        # Return demo song if Shazam fails (API key might be incomplete)
        demo_song = SongResult(
            title="Midnight Echoes",
            artist="The Neon Waves",
            album="Electric Dreams",
            cover_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400",
            genre="Electronic",
            release_year="2024"
        )
        doc = demo_song.model_dump()
        await db.songs.insert_one(doc)
        stored = await db.songs.find_one({"id": demo_song.id}, {"_id": 0})
        return {"success": True, "song": stored, "demo": True, "message": "Using demo song. Update RAPIDAPI_KEY for real recognition."}

# Get song by ID
@api_router.get("/songs/{song_id}")
async def get_song(song_id: str):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song

# Stem Separation - Real Replicate Demucs Integration
@api_router.post("/songs/{song_id}/separate")
async def separate_stems(song_id: str, file: UploadFile = File(None)):
    """Start stem separation using Replicate Demucs model.
    Accepts an audio file upload for separation."""
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Check if stems already exist for this song
    existing = await db.stems.find_one({"song_id": song_id, "status": "completed"}, {"_id": 0})
    if existing and existing.get("vocals_url", "").startswith("http"):
        return {"success": True, "stems": existing, "cached": True}

    if not REPLICATE_API_TOKEN:
        raise HTTPException(status_code=503, detail="Replicate API token not configured")

    if not file:
        raise HTTPException(status_code=400, detail="Audio file required for stem separation")

    # Save uploaded file temporarily
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Create stem record with processing status
    stem = StemStatus(song_id=song_id, status="processing")
    doc = stem.model_dump()
    await db.stems.insert_one(doc)
    stem_id = stem.id

    # Run separation in background using thread with sync MongoDB
    import threading
    import pymongo

    def run_separation_sync():
        try:
            # Write to temp file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            logger.info(f"Starting Demucs separation for song {song_id}, stem {stem_id}")

            # Run Replicate Demucs (blocking call)
            output = replicate.run(
                DEMUCS_MODEL,
                input={"audio": open(tmp_path, "rb")}
            )

            logger.info(f"Demucs output: {output}")

            # Output is a dict with bass, drums, other, vocals, piano URLs
            update_data = {
                "status": "completed",
                "vocals_url": str(output.get("vocals", "") or ""),
                "bass_url": str(output.get("bass", "") or ""),
                "drums_url": str(output.get("drums", "") or ""),
                "guitar_url": str(output.get("other", "") or output.get("guitar", "") or ""),
                "piano_url": str(output.get("piano", "") or ""),
                "original_url": ""
            }

            # Use sync pymongo for background thread
            sync_client = pymongo.MongoClient(mongo_url)
            sync_db = sync_client[os.environ['DB_NAME']]
            sync_db.stems.update_one(
                {"id": stem_id},
                {"$set": update_data}
            )
            sync_client.close()
            logger.info(f"Stem separation completed for song {song_id}")

            # Cleanup temp file
            os.unlink(tmp_path)

        except Exception as e:
            error_msg = str(e)
            if "402" in error_msg or "credit" in error_msg.lower() or "billing" in error_msg.lower():
                error_msg = "Insufficient Replicate credit. Add billing at replicate.com/account/billing"
            logger.error(f"Stem separation failed: {e}")
            try:
                sync_client = pymongo.MongoClient(mongo_url)
                sync_db = sync_client[os.environ['DB_NAME']]
                sync_db.stems.update_one(
                    {"id": stem_id},
                    {"$set": {"status": "failed", "error": error_msg}}
                )
                sync_client.close()
            except Exception as db_err:
                logger.error(f"Failed to update stem status: {db_err}")

    # Run in background thread
    thread = threading.Thread(target=run_separation_sync, daemon=True)
    thread.start()

    stored = await db.stems.find_one({"id": stem_id}, {"_id": 0})
    return {"success": True, "stems": stored, "message": "Stem separation started. Poll /api/songs/{song_id}/stems for results."}

# Get stems for a song
@api_router.get("/songs/{song_id}/stems")
async def get_stems(song_id: str):
    stems = await db.stems.find_one({"song_id": song_id}, {"_id": 0}, sort=[("created_at", -1)])
    if not stems:
        return {"success": False, "message": "No stems found. Run separation first."}
    return {"success": True, "stems": stems}

# Lyrics and Chords
@api_router.get("/songs/{song_id}/lyrics")
async def get_lyrics(song_id: str):
    """Get synced lyrics for a song via LRCLIB API, with mock fallback."""
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    title = song.get('title', '')
    artist = song.get('artist', '')

    # Try LRCLIB API first
    try:
        import httpx
        params = {"track_name": title, "artist_name": artist}
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                synced_raw = data.get("syncedLyrics") or ""
                plain_raw = data.get("plainLyrics") or ""

                if synced_raw:
                    # Parse LRC format: [mm:ss.xx] text
                    lyrics_lines = []
                    for line in synced_raw.strip().split("\n"):
                        line = line.strip()
                        if not line:
                            continue
                        # Extract timestamp [mm:ss.xx]
                        if line.startswith("[") and "]" in line:
                            ts_end = line.index("]")
                            ts_str = line[1:ts_end]
                            text = line[ts_end + 1:].strip()
                            try:
                                parts = ts_str.split(":")
                                minutes = int(parts[0])
                                seconds = float(parts[1])
                                time_s = minutes * 60 + seconds
                            except (ValueError, IndexError):
                                continue

                            if not text:
                                lyrics_lines.append({"time": time_s, "text": "", "type": "break"})
                            elif text.startswith("[") and text.endswith("]"):
                                lyrics_lines.append({"time": time_s, "text": text[1:-1], "type": "section"})
                            else:
                                lyrics_lines.append({"time": time_s, "text": text, "type": "line"})

                    if lyrics_lines:
                        mock_chords = get_mock_lyrics(title, artist).get("chords", [])
                        return {
                            "success": True,
                            "song_id": song_id,
                            "title": title,
                            "artist": artist,
                            "lyrics": lyrics_lines,
                            "chords": mock_chords,
                            "synced": True,
                            "source": "lrclib"
                        }

                elif plain_raw:
                    # Plain lyrics (no timing) — assign estimated timestamps
                    lines = [ln.strip() for ln in plain_raw.strip().split("\n")]
                    lyrics_lines = []
                    t = 0
                    for line in lines:
                        if not line:
                            lyrics_lines.append({"time": t, "text": "", "type": "break"})
                        else:
                            lyrics_lines.append({"time": t, "text": line, "type": "line"})
                        t += 3.5

                    if lyrics_lines:
                        mock_chords = get_mock_lyrics(title, artist).get("chords", [])
                        return {
                            "success": True,
                            "song_id": song_id,
                            "title": title,
                            "artist": artist,
                            "lyrics": lyrics_lines,
                            "chords": mock_chords,
                            "synced": False,
                            "source": "lrclib"
                        }
    except Exception as e:
        logger.warning(f"LRCLIB fetch failed for '{title}' by '{artist}': {e}")

    # Fallback to mock data
    mock_data = get_mock_lyrics(title, artist)
    return {
        "success": True,
        "song_id": song_id,
        "title": title,
        "artist": artist,
        **mock_data,
        "synced": False,
        "source": "mock"
    }

@api_router.get("/lyrics/search")
async def search_lyrics(track: str, artist: str = ""):
    """Search LRCLIB directly by track name and artist."""
    try:
        import httpx
        params = {"track_name": track}
        if artist:
            params["artist_name"] = artist
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "success": True,
                    "has_synced": bool(data.get("syncedLyrics")),
                    "has_plain": bool(data.get("plainLyrics")),
                    "track_name": data.get("trackName", ""),
                    "artist_name": data.get("artistName", ""),
                    "album_name": data.get("albumName", ""),
                    "duration": data.get("duration", 0),
                }
            return {"success": False, "message": "Not found on LRCLIB"}
    except Exception as e:
        return {"success": False, "message": str(e)}

# Recordings CRUD
@api_router.post("/recordings")
async def create_recording(recording: RecordingCreate):
    rec = Recording(**recording.model_dump())
    doc = rec.model_dump()
    await db.recordings.insert_one(doc)
    stored = await db.recordings.find_one({"id": rec.id}, {"_id": 0})
    return {"success": True, "recording": stored}

@api_router.get("/recordings")
async def list_recordings():
    recordings = await db.recordings.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"success": True, "recordings": recordings}

@api_router.get("/recordings/{recording_id}")
async def get_recording(recording_id: str):
    rec = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "recording": rec}

@api_router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str):
    result = await db.recordings.delete_one({"id": recording_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "message": "Recording deleted"}

# Save recording audio data
@api_router.post("/recordings/{recording_id}/audio")
async def save_recording_audio(recording_id: str, file: UploadFile = File(...)):
    audio_bytes = await file.read()
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
    result = await db.recordings.update_one(
        {"id": recording_id},
        {"$set": {"audio_data": audio_b64}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "message": "Audio saved"}

# Get all songs
@api_router.get("/songs")
async def list_songs():
    songs = await db.songs.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"success": True, "songs": songs}

# --- iTunes Music Streaming Endpoints (No API Key Required) ---

@api_router.get("/music/search")
async def music_search(q: str, limit: int = 20):
    """Search for songs using iTunes Search API - no API key needed."""
    resp = requests.get(
        "https://itunes.apple.com/search",
        params={"term": q, "media": "music", "entity": "song", "limit": limit},
        timeout=10
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Search failed")
    data = resp.json()
    tracks = []
    for item in data.get("results", []):
        tracks.append({
            "id": str(item.get("trackId", "")),
            "title": item.get("trackName", ""),
            "artist": item.get("artistName", ""),
            "album": item.get("collectionName", ""),
            "cover_url": item.get("artworkUrl100", "").replace("100x100", "600x600"),
            "cover_thumb": item.get("artworkUrl60", ""),
            "preview_url": item.get("previewUrl", ""),
            "duration_ms": item.get("trackTimeMillis", 0),
            "genre": item.get("primaryGenreName", ""),
            "release_date": item.get("releaseDate", ""),
            "artist_id": str(item.get("artistId", "")),
            "album_id": str(item.get("collectionId", "")),
        })
    return {"success": True, "tracks": tracks, "count": len(tracks)}

@api_router.get("/music/top-songs")
async def music_top_songs(genre: str = "", limit: int = 20):
    """Get top songs from iTunes RSS feeds - no API key needed."""
    url = f"https://itunes.apple.com/us/rss/topsongs/limit={limit}"
    if genre:
        url += f"/genre={genre}"
    url += "/json"
    resp = requests.get(url, timeout=10)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch top songs")
    data = resp.json()
    entries = data.get("feed", {}).get("entry", [])
    tracks = []
    for item in entries:
        img_list = item.get("im:image", [])
        cover = img_list[-1].get("label", "") if img_list else ""
        tracks.append({
            "id": item.get("id", {}).get("attributes", {}).get("im:id", ""),
            "title": item.get("im:name", {}).get("label", ""),
            "artist": item.get("im:artist", {}).get("label", ""),
            "album": item.get("im:collection", {}).get("im:name", {}).get("label", "") if item.get("im:collection") else "",
            "cover_url": cover.replace("170x170", "600x600"),
            "cover_thumb": cover,
            "preview_url": "",
            "genre": item.get("category", {}).get("attributes", {}).get("label", ""),
            "release_date": item.get("im:releaseDate", {}).get("label", ""),
        })
    return {"success": True, "tracks": tracks, "count": len(tracks)}

@api_router.get("/music/top-albums")
async def music_top_albums(limit: int = 20):
    """Get top albums from iTunes RSS feeds."""
    resp = requests.get(
        f"https://itunes.apple.com/us/rss/topalbums/limit={limit}/json",
        timeout=10
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch top albums")
    data = resp.json()
    entries = data.get("feed", {}).get("entry", [])
    albums = []
    for item in entries:
        img_list = item.get("im:image", [])
        cover = img_list[-1].get("label", "") if img_list else ""
        albums.append({
            "id": item.get("id", {}).get("attributes", {}).get("im:id", ""),
            "name": item.get("im:name", {}).get("label", ""),
            "artist": item.get("im:artist", {}).get("label", ""),
            "cover_url": cover.replace("170x170", "600x600"),
            "cover_thumb": cover,
            "genre": item.get("category", {}).get("attributes", {}).get("label", ""),
            "release_date": item.get("im:releaseDate", {}).get("label", ""),
            "link": item.get("link", {}).get("attributes", {}).get("href", ""),
        })
    return {"success": True, "albums": albums, "count": len(albums)}

@api_router.get("/music/artist/{artist_id}")
async def music_artist(artist_id: str, limit: int = 10):
    """Lookup artist and their top songs."""
    resp = requests.get(
        "https://itunes.apple.com/lookup",
        params={"id": artist_id, "entity": "song", "limit": limit},
        timeout=10
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Artist lookup failed")
    data = resp.json()
    results = data.get("results", [])
    artist_info = results[0] if results else {}
    songs = []
    for item in results[1:]:
        if item.get("wrapperType") == "track":
            songs.append({
                "id": str(item.get("trackId", "")),
                "title": item.get("trackName", ""),
                "artist": item.get("artistName", ""),
                "album": item.get("collectionName", ""),
                "cover_url": item.get("artworkUrl100", "").replace("100x100", "600x600"),
                "preview_url": item.get("previewUrl", ""),
                "duration_ms": item.get("trackTimeMillis", 0),
            })
    return {
        "success": True,
        "artist": {
            "id": str(artist_info.get("artistId", "")),
            "name": artist_info.get("artistName", ""),
            "genre": artist_info.get("primaryGenreName", ""),
        },
        "songs": songs,
    }

@api_router.get("/music/album/{album_id}")
async def music_album(album_id: str):
    """Lookup album tracks."""
    resp = requests.get(
        "https://itunes.apple.com/lookup",
        params={"id": album_id, "entity": "song"},
        timeout=10
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Album lookup failed")
    data = resp.json()
    results = data.get("results", [])
    album_info = results[0] if results else {}
    tracks = []
    for item in results[1:]:
        if item.get("wrapperType") == "track":
            tracks.append({
                "id": str(item.get("trackId", "")),
                "title": item.get("trackName", ""),
                "artist": item.get("artistName", ""),
                "preview_url": item.get("previewUrl", ""),
                "duration_ms": item.get("trackTimeMillis", 0),
                "track_number": item.get("trackNumber", 0),
            })
    return {
        "success": True,
        "album": {
            "id": str(album_info.get("collectionId", "")),
            "name": album_info.get("collectionName", ""),
            "artist": album_info.get("artistName", ""),
            "cover_url": album_info.get("artworkUrl100", "").replace("100x100", "600x600"),
            "genre": album_info.get("primaryGenreName", ""),
            "track_count": album_info.get("trackCount", 0),
        },
        "tracks": tracks,
    }

# --- Cover Battle Endpoints ---

@api_router.post("/battles")
async def create_battle(battle: BattleCreate):
    """Create a new cover battle for a song."""
    b = Battle(**battle.model_dump())
    doc = b.model_dump()
    await db.battles.insert_one(doc)
    stored = await db.battles.find_one({"id": b.id}, {"_id": 0})
    return {"success": True, "battle": stored}

@api_router.get("/battles")
async def list_battles(status: str = "active", limit: int = 20):
    """List battles with cover counts."""
    query = {}
    if status:
        query["status"] = status
    battles = await db.battles.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return {"success": True, "battles": battles}

@api_router.get("/battles/{battle_id}")
async def get_battle(battle_id: str):
    """Get battle with all covers sorted by votes."""
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    covers = await db.covers.find({"battle_id": battle_id}, {"_id": 0, "audio_data": 0}).sort("votes", -1).to_list(100)
    return {"success": True, "battle": battle, "covers": covers}

@api_router.post("/battles/{battle_id}/submit")
async def submit_cover(battle_id: str, username: str = Form(...), title: str = Form(""), file: UploadFile = File(...)):
    """Submit a cover recording to a battle."""
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")
    if battle.get("status") != "active":
        raise HTTPException(status_code=400, detail="Battle is no longer active")

    audio_bytes = await file.read()
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

    cover = Cover(battle_id=battle_id, username=username, title=title or f"{username}'s Cover", audio_data=audio_b64)
    doc = cover.model_dump()
    await db.covers.insert_one(doc)

    await db.battles.update_one({"id": battle_id}, {"$inc": {"cover_count": 1}})

    stored = await db.covers.find_one({"id": cover.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "cover": stored}

@api_router.post("/battles/{battle_id}/vote/{cover_id}")
async def vote_cover(battle_id: str, cover_id: str, voter_id: str = Form(...)):
    """Vote for a cover. Each voter can only vote once per cover."""
    cover = await db.covers.find_one({"id": cover_id, "battle_id": battle_id})
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")

    if voter_id in cover.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted for this cover")

    await db.covers.update_one(
        {"id": cover_id},
        {"$inc": {"votes": 1}, "$push": {"voters": voter_id}}
    )
    updated = await db.covers.find_one({"id": cover_id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "cover": updated}

@api_router.get("/battles/{battle_id}/cover/{cover_id}/audio")
async def get_cover_audio(battle_id: str, cover_id: str):
    """Get the audio data for a cover."""
    cover = await db.covers.find_one({"id": cover_id, "battle_id": battle_id}, {"_id": 0})
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")
    return {"success": True, "audio_data": cover.get("audio_data", "")}

@api_router.get("/battles/leaderboard/top")
async def battle_leaderboard(limit: int = 20):
    """Get top covers across all battles."""
    pipeline = [
        {"$project": {"_id": 0, "audio_data": 0}},
        {"$sort": {"votes": -1}},
        {"$limit": limit}
    ]
    top_covers = await db.covers.aggregate(pipeline).to_list(limit)
    # Enrich with battle info
    for cover in top_covers:
        battle = await db.battles.find_one({"id": cover.get("battle_id")}, {"_id": 0})
        if battle:
            cover["song_title"] = battle.get("song_title", "")
            cover["song_artist"] = battle.get("song_artist", "")
            cover["song_cover_url"] = battle.get("song_cover_url", "")
    return {"success": True, "leaderboard": top_covers}

# --- Playlist Endpoints ---

@api_router.post("/playlists")
async def create_playlist(playlist: PlaylistCreate):
    pl = Playlist(**playlist.model_dump())
    doc = pl.model_dump()
    await db.playlists.insert_one(doc)
    stored = await db.playlists.find_one({"id": pl.id}, {"_id": 0})
    return {"success": True, "playlist": stored}

@api_router.get("/playlists")
async def list_playlists(owner: str = "", public_only: bool = False):
    query = {}
    if owner:
        query["owner"] = owner
    if public_only:
        query["is_public"] = True
    playlists = await db.playlists.find(query, {"_id": 0, "tracks": 0}).sort("created_at", -1).to_list(50)
    return {"success": True, "playlists": playlists}

@api_router.get("/playlists/{playlist_id}")
async def get_playlist(playlist_id: str):
    pl = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"success": True, "playlist": pl}

@api_router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(playlist_id: str, track: PlaylistAddTrack):
    pl = await db.playlists.find_one({"id": playlist_id})
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    track_doc = track.model_dump()
    track_doc["added_at"] = datetime.now(timezone.utc).isoformat()
    await db.playlists.update_one(
        {"id": playlist_id},
        {"$push": {"tracks": track_doc}, "$inc": {"track_count": 1}}
    )
    # Update cover with first track's cover
    if not pl.get("cover_url") and track.cover_url:
        await db.playlists.update_one({"id": playlist_id}, {"$set": {"cover_url": track.cover_url}})
    stored = await db.playlists.find_one({"id": playlist_id}, {"_id": 0})
    return {"success": True, "playlist": stored}

@api_router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(playlist_id: str, track_id: str):
    result = await db.playlists.update_one(
        {"id": playlist_id},
        {"$pull": {"tracks": {"track_id": track_id}}, "$inc": {"track_count": -1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Track not found in playlist")
    return {"success": True, "message": "Track removed"}

@api_router.put("/playlists/{playlist_id}")
async def update_playlist(playlist_id: str, name: str = Form(""), is_public: bool = Form(True)):
    update = {}
    if name:
        update["name"] = name
    update["is_public"] = is_public
    result = await db.playlists.update_one({"id": playlist_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    stored = await db.playlists.find_one({"id": playlist_id}, {"_id": 0, "tracks": 0})
    return {"success": True, "playlist": stored}

@api_router.delete("/playlists/{playlist_id}")
async def delete_playlist(playlist_id: str):
    result = await db.playlists.delete_one({"id": playlist_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {"success": True, "message": "Playlist deleted"}

# --- Duet Endpoints ---

class DuetCreate(BaseModel):
    battle_id: str
    cover_id: str
    username: str
    partner_username: str = ""
    title: str = ""

class DuetRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    battle_id: str
    cover_id: str
    username: str
    partner_username: str = ""
    title: str = ""
    audio_data: str = ""
    song_title: str = ""
    song_artist: str = ""
    song_cover_url: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@api_router.post("/duets")
async def create_duet(username: str = Form(...), battle_id: str = Form(...), cover_id: str = Form(...), title: str = Form(""), file: UploadFile = File(...)):
    """Save a duet recording."""
    battle = await db.battles.find_one({"id": battle_id}, {"_id": 0})
    if not battle:
        raise HTTPException(status_code=404, detail="Battle not found")

    cover = await db.covers.find_one({"id": cover_id, "battle_id": battle_id}, {"_id": 0, "audio_data": 0})
    if not cover:
        raise HTTPException(status_code=404, detail="Cover not found")

    audio_bytes = await file.read()
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

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
    doc = duet.model_dump()
    await db.duets.insert_one(doc)
    stored = await db.duets.find_one({"id": duet.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "duet": stored}

@api_router.get("/duets")
async def list_duets(username: str = "", limit: int = 20):
    """List duets, optionally filtered by username."""
    query = {}
    if username:
        query["username"] = username
    duets = await db.duets.find(query, {"_id": 0, "audio_data": 0}).sort("created_at", -1).to_list(limit)
    return {"success": True, "duets": duets}

@api_router.get("/duets/{duet_id}")
async def get_duet(duet_id: str):
    """Get a duet by ID (without audio data)."""
    duet = await db.duets.find_one({"id": duet_id}, {"_id": 0, "audio_data": 0})
    if not duet:
        raise HTTPException(status_code=404, detail="Duet not found")
    return {"success": True, "duet": duet}

@api_router.get("/duets/{duet_id}/audio")
async def get_duet_audio(duet_id: str):
    """Get the audio data for a duet."""
    duet = await db.duets.find_one({"id": duet_id}, {"_id": 0})
    if not duet:
        raise HTTPException(status_code=404, detail="Duet not found")
    return {"success": True, "audio_data": duet.get("audio_data", "")}

# --- Become a Star (Karaoke) Endpoints ---

class StarPerformance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    song_title: str = ""
    song_artist: str = ""
    song_cover_url: str = ""
    song_id: str = ""
    title: str = ""
    audio_data: str = ""
    challenge_id: str = ""
    votes: int = 0
    voters: List[str] = []
    status: str = "published"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@api_router.post("/stars")
async def submit_star_performance(
    username: str = Form(...),
    song_title: str = Form(""),
    song_artist: str = Form(""),
    song_cover_url: str = Form(""),
    song_id: str = Form(""),
    title: str = Form(""),
    challenge_id: str = Form(""),
    file: UploadFile = File(...)
):
    """Submit a karaoke performance to Become a Star feed."""
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')

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
    doc = perf.model_dump()
    await db.stars.insert_one(doc)
    stored = await db.stars.find_one({"id": perf.id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "performance": stored}

@api_router.get("/stars/feed")
async def star_feed(limit: int = 30):
    """Get the public Star feed, sorted by most recent."""
    performances = await db.stars.find(
        {"status": "published"}, {"_id": 0, "audio_data": 0}
    ).sort("created_at", -1).to_list(limit)
    return {"success": True, "performances": performances}

@api_router.get("/stars/leaderboard")
async def star_leaderboard(limit: int = 20):
    """Get top-voted star performances."""
    pipeline = [
        {"$match": {"status": "published"}},
        {"$project": {"_id": 0, "audio_data": 0}},
        {"$sort": {"votes": -1}},
        {"$limit": limit}
    ]
    top = await db.stars.aggregate(pipeline).to_list(limit)
    return {"success": True, "leaderboard": top}

@api_router.get("/stars/{perf_id}")
async def get_star_performance(perf_id: str):
    """Get a single star performance (without audio)."""
    perf = await db.stars.find_one({"id": perf_id}, {"_id": 0, "audio_data": 0})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    return {"success": True, "performance": perf}

@api_router.get("/stars/{perf_id}/audio")
async def get_star_audio(perf_id: str):
    """Get the audio data for a star performance."""
    perf = await db.stars.find_one({"id": perf_id}, {"_id": 0})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    return {"success": True, "audio_data": perf.get("audio_data", "")}

@api_router.post("/stars/{perf_id}/vote")
async def vote_star(perf_id: str, voter_id: str = Form(...)):
    """Vote for a star performance. Each voter can vote once."""
    perf = await db.stars.find_one({"id": perf_id})
    if not perf:
        raise HTTPException(status_code=404, detail="Performance not found")
    if voter_id in perf.get("voters", []):
        raise HTTPException(status_code=400, detail="Already voted")
    await db.stars.update_one(
        {"id": perf_id},
        {"$inc": {"votes": 1}, "$push": {"voters": voter_id}}
    )
    updated = await db.stars.find_one({"id": perf_id}, {"_id": 0, "audio_data": 0})
    return {"success": True, "performance": updated}

# --- Star Challenges (Wednesday to Wednesday) ---

CHALLENGE_THEMES = [
    {"title": "90s Throwback", "desc": "Sing your favorite 90s hit!", "emoji": "cassette"},
    {"title": "Power Ballads", "desc": "Belt out the biggest ballads of all time", "emoji": "fire"},
    {"title": "Acoustic Vibes", "desc": "Strip it back — acoustic covers only", "emoji": "guitar"},
    {"title": "Hip-Hop Classics", "desc": "Spit bars from the golden era", "emoji": "mic"},
    {"title": "Pop Anthems", "desc": "Sing the catchiest pop songs ever made", "emoji": "star"},
    {"title": "Rock Legends", "desc": "Channel your inner rock god", "emoji": "guitar"},
    {"title": "R&B Grooves", "desc": "Smooth vocals and soulful melodies", "emoji": "music"},
    {"title": "Country Roads", "desc": "Twang it out — country hits only", "emoji": "hat"},
    {"title": "Movie Soundtracks", "desc": "Sing iconic songs from the silver screen", "emoji": "film"},
    {"title": "Freestyle Friday", "desc": "Anything goes — surprise us!", "emoji": "sparkle"},
    {"title": "Duet Anthems", "desc": "Songs made for two — solo or duo!", "emoji": "users"},
    {"title": "One-Hit Wonders", "desc": "Celebrate the songs that defined a moment", "emoji": "flash"},
]

def get_current_challenge_dates():
    """Get the current Wednesday-to-Wednesday window."""
    now = datetime.now(timezone.utc)
    days_since_wed = (now.weekday() - 2) % 7
    start = (now - timedelta(days=days_since_wed)).replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=7)
    return start, end

def get_week_number():
    """Get a consistent week number for theme rotation."""
    now = datetime.now(timezone.utc)
    epoch = datetime(2025, 1, 1, tzinfo=timezone.utc)
    days = (now - epoch).days
    return days // 7

@api_router.get("/challenges/current")
async def get_current_challenge():
    """Get or create the current weekly challenge (Wed-Wed)."""
    start, end = get_current_challenge_dates()
    start_iso = start.isoformat()
    end_iso = end.isoformat()

    existing = await db.challenges.find_one({"start_date": start_iso}, {"_id": 0})
    if existing:
        # Count entries and find Star of the Week
        entry_count = await db.stars.count_documents({"challenge_id": existing["id"]})
        star_of_week = None
        top = await db.stars.find(
            {"challenge_id": existing["id"]}, {"_id": 0, "audio_data": 0}
        ).sort("votes", -1).to_list(1)
        if top and top[0].get("votes", 0) > 0:
            star_of_week = top[0]
        existing["entry_count"] = entry_count
        existing["star_of_week"] = star_of_week
        return {"success": True, "challenge": existing}

    # Create new challenge
    week_num = get_week_number()
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

@api_router.get("/challenges/{challenge_id}/entries")
async def get_challenge_entries(challenge_id: str, limit: int = 30):
    """Get performances submitted to a specific challenge."""
    challenge = await db.challenges.find_one({"id": challenge_id}, {"_id": 0})
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")
    entries = await db.stars.find(
        {"challenge_id": challenge_id}, {"_id": 0, "audio_data": 0}
    ).sort("votes", -1).to_list(limit)
    return {"success": True, "challenge": challenge, "entries": entries}

@api_router.get("/challenges/history")
async def challenge_history(limit: int = 10):
    """Get past challenges with their Star of the Week."""
    challenges = await db.challenges.find(
        {}, {"_id": 0}
    ).sort("start_date", -1).to_list(limit)

    results = []
    for ch in challenges:
        top = await db.stars.find(
            {"challenge_id": ch["id"]}, {"_id": 0, "audio_data": 0}
        ).sort("votes", -1).to_list(1)
        ch["star_of_week"] = top[0] if top and top[0].get("votes", 0) > 0 else None
        ch["entry_count"] = await db.stars.count_documents({"challenge_id": ch["id"]})
        results.append(ch)
    return {"success": True, "challenges": results}

# --- Subscription / Pricing Tier Definitions ---

SUBSCRIPTION_TIERS = [
    {
        "key": "stadium_vip",
        "name": "Stadium VIP",
        "tagline": "Fan Pass",
        "price": 4.98,
        "period": "month",
        "features": [
            "Save & share personal mixes to profile",
            "Exclusive neon chat badges & emojis",
            "Priority DM access to artists during live sessions",
        ],
        "category": "fan",
        "highlight": True,
    },
    {
        "key": "individual",
        "name": "Individual",
        "tagline": "Solo Artist",
        "price": 11.98,
        "period": "month",
        "features": [
            "Unlimited skips",
            "Full stem separation",
            "HD audio export",
            "All karaoke features",
        ],
        "category": "creator",
        "highlight": False,
    },
    {
        "key": "student",
        "name": "Student",
        "tagline": "Study & Play",
        "price": 9.98,
        "period": "month",
        "features": [
            "All Individual features",
            "Valid student email required",
            "Discounted creator tools",
        ],
        "category": "creator",
        "highlight": False,
    },
    {
        "key": "couple_duo",
        "name": "Couple / Duo",
        "tagline": "Two Voices",
        "price": 14.98,
        "period": "month",
        "features": [
            "2 accounts",
            "Shared duet workspace",
            "Unlimited skips for both",
            "Priority duet matching",
        ],
        "category": "creator",
        "highlight": False,
    },
    {
        "key": "family",
        "name": "Family",
        "tagline": "Up to 5 members",
        "price": 20.98,
        "period": "month",
        "features": [
            "5 individual accounts",
            "Family mix playlists",
            "Parental controls",
            "All creator features",
        ],
        "category": "creator",
        "highlight": False,
    },
    {
        "key": "adult_band",
        "name": "Adult Band",
        "tagline": "Active Band",
        "price": 17.98,
        "period": "month",
        "features": [
            "Up to 8 members",
            "Band collaboration room",
            "Shared stem library",
            "1 upload/week to stay active",
        ],
        "category": "band",
        "highlight": False,
    },
    {
        "key": "under18_band",
        "name": "Under-18 Band",
        "tagline": "Young Stars",
        "price": 2.98,
        "period": "month",
        "features": [
            "Up to 8 members",
            "Band collaboration room",
            "Shared stem library",
            "Safe community features",
        ],
        "category": "band",
        "highlight": False,
    },
]


class SubscriptionSelect(BaseModel):
    user_id: str
    tier_key: str


class TrimRequest(BaseModel):
    recording_id: str = ""
    start_pct: float = 0
    end_pct: float = 100


@api_router.get("/subscriptions/tiers")
async def list_subscription_tiers():
    """Return all available subscription tiers."""
    return {"success": True, "tiers": SUBSCRIPTION_TIERS}


@api_router.post("/subscriptions/select")
async def select_subscription(payload: SubscriptionSelect):
    """Select a subscription tier for a user (mock checkout — no real payment yet)."""
    tier = next((t for t in SUBSCRIPTION_TIERS if t["key"] == payload.tier_key), None)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier key")

    now = datetime.now(timezone.utc)
    trial_end = (now + timedelta(days=30)).isoformat()

    # Upsert subscription document
    sub_doc = {
        "user_id": payload.user_id,
        "tier_key": tier["key"],
        "tier_name": tier["name"],
        "price": tier["price"],
        "status": "trial",
        "trial_end": trial_end,
        "started_at": now.isoformat(),
        "last_upload": None,
        "active_band": tier["category"] == "band",
        "reward_months": 0,
    }

    await db.subscriptions.update_one(
        {"user_id": payload.user_id},
        {"$set": sub_doc},
        upsert=True,
    )

    stored = await db.subscriptions.find_one(
        {"user_id": payload.user_id}, {"_id": 0}
    )
    return {"success": True, "subscription": stored}


@api_router.get("/subscriptions/{user_id}/status")
async def get_subscription_status(user_id: str):
    """Check a user's current subscription status."""
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if not sub:
        return {
            "success": True,
            "subscription": None,
            "is_pro": False,
            "is_vip": False,
            "tier_key": "free",
        }

    tier_key = sub.get("tier_key", "free")
    is_band = tier_key in ("adult_band", "under18_band")

    # Band upload tracking
    upload_status = None
    if is_band:
        now = datetime.now(timezone.utc)
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_end = week_start + timedelta(days=7)
        uploads_this_week = await db.band_uploads.count_documents(
            {
                "user_id": user_id,
                "uploaded_at": {"$gte": week_start.isoformat(), "$lt": week_end.isoformat()},
            }
        )
        upload_status = {
            "uploads_this_week": uploads_this_week,
            "required": 1,
            "met": uploads_this_week >= 1,
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
        }

    return {
        "success": True,
        "subscription": sub,
        "is_pro": tier_key != "free",
        "is_vip": tier_key == "stadium_vip",
        "is_band": is_band,
        "tier_key": tier_key,
        "upload_status": upload_status,
    }


@api_router.post("/subscriptions/{user_id}/upload")
async def record_band_upload(user_id: str):
    """Record a band upload for the weekly tracker."""
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    if not sub or sub.get("tier_key") not in ("adult_band", "under18_band"):
        raise HTTPException(status_code=400, detail="Not a band subscription")

    now = datetime.now(timezone.utc)
    doc = {
        "user_id": user_id,
        "uploaded_at": now.isoformat(),
    }
    await db.band_uploads.insert_one(doc)

    # Update last_upload on subscription
    await db.subscriptions.update_one(
        {"user_id": user_id}, {"$set": {"last_upload": now.isoformat()}}
    )
    return {"success": True, "message": "Upload recorded"}


# --- Trim API ---

@api_router.post("/trim")
async def trim_recording(payload: TrimRequest):
    """Trim a recording by percentage range. Returns trimmed metadata."""
    if payload.start_pct < 0 or payload.end_pct > 100 or payload.start_pct >= payload.end_pct:
        raise HTTPException(status_code=400, detail="Invalid trim range")

    # For now, return confirmation with the trim parameters
    # Real implementation would slice audio/video binary data
    return {
        "success": True,
        "recording_id": payload.recording_id,
        "start_pct": payload.start_pct,
        "end_pct": payload.end_pct,
        "message": "Trim parameters saved. Full server-side trimming coming soon.",
    }


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
