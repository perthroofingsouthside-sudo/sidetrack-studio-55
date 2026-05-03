"""Song recognition, stem separation, lyrics endpoints."""
from fastapi import APIRouter, UploadFile, File, HTTPException
from database import db
from models import SongResult, StemStatus, Recording, RecordingCreate
from config import RAPIDAPI_KEY, RAPIDAPI_HOST, REPLICATE_API_TOKEN, DEMUCS_MODEL
import base64, os, tempfile, logging, threading, requests
import replicate
import pymongo

logger = logging.getLogger(__name__)
router = APIRouter()
mongo_url = os.environ['MONGO_URL']


async def recognize_with_shazam(audio_bytes: bytes):
    try:
        raw_audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
        headers = {"x-rapidapi-key": RAPIDAPI_KEY, "x-rapidapi-host": RAPIDAPI_HOST, "Content-Type": "text/plain"}
        response = requests.post("https://shazam.p.rapidapi.com/songs/detect", data=raw_audio_b64, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
        if result.get('matches') and len(result['matches']) > 0:
            track = result.get('track', {})
            return {
                "title": track.get('title', 'Unknown'), "artist": track.get('subtitle', 'Unknown Artist'),
                "album": track.get('sections', [{}])[0].get('metadata', [{}])[0].get('text', '') if track.get('sections') else '',
                "cover_url": track.get('images', {}).get('coverarthq', track.get('images', {}).get('coverart', '')),
                "shazam_key": track.get('key', ''), "genre": track.get('genres', {}).get('primary', ''), "release_year": ""
            }
        return None
    except Exception as e:
        logger.error(f"Shazam API error: {e}")
        return None


@router.post("/recognize")
async def recognize_song(file: UploadFile = File(...)):
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    result = await recognize_with_shazam(audio_bytes)
    if result:
        song = SongResult(**result)
        await db.songs.insert_one(song.model_dump())
        stored = await db.songs.find_one({"id": song.id}, {"_id": 0})
        return {"success": True, "song": stored}
    demo_song = SongResult(title="Midnight Echoes", artist="The Neon Waves", album="Electric Dreams",
        cover_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400", genre="Electronic", release_year="2024")
    await db.songs.insert_one(demo_song.model_dump())
    stored = await db.songs.find_one({"id": demo_song.id}, {"_id": 0})
    return {"success": True, "song": stored, "demo": True, "message": "Using demo song. Update RAPIDAPI_KEY for real recognition."}


@router.get("/songs/{song_id}")
async def get_song(song_id: str):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    return song


@router.get("/songs")
async def list_songs():
    songs = await db.songs.find({}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"success": True, "songs": songs}


@router.post("/songs/{song_id}/separate")
async def separate_stems(song_id: str, file: UploadFile = File(None)):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    existing = await db.stems.find_one({"song_id": song_id, "status": "completed"}, {"_id": 0})
    if existing and existing.get("vocals_url", "").startswith("http"):
        return {"success": True, "stems": existing, "cached": True}
    if not REPLICATE_API_TOKEN:
        raise HTTPException(status_code=503, detail="Replicate API token not configured")
    if not file:
        raise HTTPException(status_code=400, detail="Audio file required for stem separation")
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    stem = StemStatus(song_id=song_id, status="processing")
    await db.stems.insert_one(stem.model_dump())
    stem_id = stem.id

    def run_separation_sync():
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name
            output = replicate.run(DEMUCS_MODEL, input={"audio": open(tmp_path, "rb")})
            update_data = {"status": "completed", "vocals_url": str(output.get("vocals", "") or ""),
                "bass_url": str(output.get("bass", "") or ""), "drums_url": str(output.get("drums", "") or ""),
                "guitar_url": str(output.get("other", "") or output.get("guitar", "") or ""),
                "piano_url": str(output.get("piano", "") or ""), "original_url": ""}
            sync_client = pymongo.MongoClient(mongo_url)
            sync_db = sync_client[os.environ['DB_NAME']]
            sync_db.stems.update_one({"id": stem_id}, {"$set": update_data})
            sync_client.close()
            os.unlink(tmp_path)
        except Exception as e:
            error_msg = str(e)
            if "402" in error_msg or "credit" in error_msg.lower():
                error_msg = "Insufficient Replicate credit."
            try:
                sync_client = pymongo.MongoClient(mongo_url)
                sync_db = sync_client[os.environ['DB_NAME']]
                sync_db.stems.update_one({"id": stem_id}, {"$set": {"status": "failed", "error": error_msg}})
                sync_client.close()
            except Exception:
                pass

    threading.Thread(target=run_separation_sync, daemon=True).start()
    stored = await db.stems.find_one({"id": stem_id}, {"_id": 0})
    return {"success": True, "stems": stored, "message": "Stem separation started."}


@router.get("/songs/{song_id}/stems")
async def get_stems(song_id: str):
    stems = await db.stems.find_one({"song_id": song_id}, {"_id": 0}, sort=[("created_at", -1)])
    if not stems:
        return {"success": False, "message": "No stems found."}
    return {"success": True, "stems": stems}


# --- Recordings CRUD ---

@router.post("/recordings")
async def create_recording(recording: RecordingCreate):
    rec = Recording(**recording.model_dump())
    await db.recordings.insert_one(rec.model_dump())
    stored = await db.recordings.find_one({"id": rec.id}, {"_id": 0})
    return {"success": True, "recording": stored}


@router.get("/recordings")
async def list_recordings():
    recordings = await db.recordings.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"success": True, "recordings": recordings}


@router.get("/recordings/{recording_id}")
async def get_recording(recording_id: str):
    rec = await db.recordings.find_one({"id": recording_id}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "recording": rec}


@router.delete("/recordings/{recording_id}")
async def delete_recording(recording_id: str):
    result = await db.recordings.delete_one({"id": recording_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "message": "Recording deleted"}


@router.post("/recordings/{recording_id}/audio")
async def save_recording_audio(recording_id: str, file: UploadFile = File(...)):
    audio_bytes = await file.read()
    audio_b64 = base64.b64encode(audio_bytes).decode('utf-8')
    result = await db.recordings.update_one({"id": recording_id}, {"$set": {"audio_data": audio_b64}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Recording not found")
    return {"success": True, "message": "Audio saved"}
