from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import base64
import requests
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone

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
    return {"message": "AuraSplit API"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "shazam_configured": bool(RAPIDAPI_KEY)}

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

# Stem Separation
@api_router.post("/songs/{song_id}/separate")
async def separate_stems(song_id: str):
    """Start stem separation for a song (MOCKED - needs Replicate API key)."""
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    stem = StemStatus(
        song_id=song_id,
        status="completed",
        vocals_url="mock://vocals",
        guitar_url="mock://guitar",
        bass_url="mock://bass",
        drums_url="mock://drums",
        original_url="mock://original"
    )
    doc = stem.model_dump()
    await db.stems.insert_one(doc)
    stored = await db.stems.find_one({"id": stem.id}, {"_id": 0})
    return {"success": True, "stems": stored, "mocked": True, "message": "Stem separation is MOCKED. Provide REPLICATE_API_TOKEN for real separation."}

# Get stems for a song
@api_router.get("/songs/{song_id}/stems")
async def get_stems(song_id: str):
    stems = await db.stems.find_one({"song_id": song_id}, {"_id": 0})
    if not stems:
        return {"success": False, "message": "No stems found. Run separation first."}
    return {"success": True, "stems": stems}

# Lyrics and Chords
@api_router.get("/songs/{song_id}/lyrics")
async def get_lyrics(song_id: str):
    """Get lyrics and chord progressions for a song (MOCKED)."""
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    mock_data = get_mock_lyrics(song.get('title', ''), song.get('artist', ''))
    return {
        "success": True,
        "song_id": song_id,
        "title": song.get('title', ''),
        "artist": song.get('artist', ''),
        **mock_data,
        "mocked": True
    }

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
