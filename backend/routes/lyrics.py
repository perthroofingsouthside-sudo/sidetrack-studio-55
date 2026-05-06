"""Lyrics, Chords engine — LRCLIB + music-theory chord generation."""
from fastapi import APIRouter, HTTPException
from database import db
import logging
import httpx

logger = logging.getLogger(__name__)
router = APIRouter()

# --- Music Theory Chord Engine ---
# Maps keys to diatonic chord progressions (I ii iii IV V vi vii)
KEY_CHORDS = {
    "C":  ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
    "G":  ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
    "D":  ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
    "A":  ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
    "E":  ["E", "F#m", "G#m", "A", "B", "C#m", "D#dim"],
    "F":  ["F", "Gm", "Am", "Bb", "C", "Dm", "Edim"],
    "Bb": ["Bb", "Cm", "Dm", "Eb", "F", "Gm", "Adim"],
    "Eb": ["Eb", "Fm", "Gm", "Ab", "Bb", "Cm", "Ddim"],
    "Am": ["Am", "Bdim", "C", "Dm", "Em", "F", "G"],
    "Em": ["Em", "F#dim", "G", "Am", "Bm", "C", "D"],
    "Dm": ["Dm", "Edim", "F", "Gm", "Am", "Bb", "C"],
}

# Common progressions by genre (indices into KEY_CHORDS)
GENRE_PROGRESSIONS = {
    "pop":        [[0,4,5,3], [0,5,3,4], [5,3,0,4]],
    "rock":       [[0,3,4,4], [0,4,5,3], [0,3,0,4]],
    "electronic": [[5,3,0,4], [0,4,5,3]],
    "hip-hop":    [[5,3,0,4], [0,5,3,4]],
    "r&b":        [[0,5,3,4], [5,0,3,4]],
    "country":    [[0,4,0,3], [0,3,4,0]],
    "jazz":       [[0,3,4,0], [1,4,0,3]],
    "classical":  [[0,3,4,0], [0,4,0,3]],
    "default":    [[0,4,5,3], [5,3,0,4], [0,3,4,0]],
}

# Genre-to-key heuristics
GENRE_KEYS = {
    "pop": "C", "rock": "E", "electronic": "Am", "hip-hop": "Am",
    "r&b": "Dm", "country": "G", "jazz": "F", "classical": "C",
    "alternative": "Em", "indie": "G", "metal": "Em", "blues": "A",
}


def detect_key(genre: str = "", title: str = "") -> str:
    genre_lower = genre.lower()
    for g, k in GENRE_KEYS.items():
        if g in genre_lower:
            return k
    return "C"


def generate_chords(key: str, genre: str = "", duration_s: float = 92) -> list:
    """Generate musically-accurate chord progression based on key and genre."""
    chords_in_key = KEY_CHORDS.get(key, KEY_CHORDS["C"])
    genre_lower = genre.lower() if genre else "default"
    progressions = GENRE_PROGRESSIONS.get("default")
    for g, progs in GENRE_PROGRESSIONS.items():
        if g in genre_lower:
            progressions = progs
            break

    result = []
    t = 0.0
    beat_dur = 4.0  # 4 seconds per chord
    prog_idx = 0
    while t < duration_s:
        prog = progressions[prog_idx % len(progressions)]
        for chord_idx in prog:
            if t >= duration_s:
                break
            chord_name = chords_in_key[chord_idx % len(chords_in_key)]
            result.append({"time": round(t, 1), "chord": chord_name, "duration": beat_dur})
            t += beat_dur
        prog_idx += 1
    return result


def get_mock_lyrics(title: str, artist: str) -> dict:
    return {
        "lyrics": [
            {"time": 0, "text": "[Intro]", "type": "section"},
            {"time": 4, "text": "The lights go down, the music starts to play", "type": "line"},
            {"time": 8, "text": "A melody that takes my breath away", "type": "line"},
            {"time": 12, "text": "", "type": "break"},
            {"time": 14, "text": "[Verse 1]", "type": "section"},
            {"time": 16, "text": "Walking through the city after dark", "type": "line"},
            {"time": 20, "text": "Every sound is music to my heart", "type": "line"},
            {"time": 24, "text": "Rhythm in the raindrops on the street", "type": "line"},
            {"time": 28, "text": "Dancing to the sound of every beat", "type": "line"},
            {"time": 32, "text": "", "type": "break"},
            {"time": 34, "text": "[Chorus]", "type": "section"},
            {"time": 36, "text": "Turn it up, let the music set you free", "type": "line"},
            {"time": 40, "text": "Feel the bass line running through your veins", "type": "line"},
            {"time": 44, "text": "Nothing else matters when the speakers breathe", "type": "line"},
            {"time": 48, "text": "Lost in sound, forget about the pain", "type": "line"},
            {"time": 52, "text": "", "type": "break"},
            {"time": 54, "text": "[Verse 2]", "type": "section"},
            {"time": 56, "text": "Frequencies that vibrate through the night", "type": "line"},
            {"time": 60, "text": "Every note is burning like a light", "type": "line"},
            {"time": 64, "text": "Harmonies that echo in my soul", "type": "line"},
            {"time": 68, "text": "This is where the broken become whole", "type": "line"},
            {"time": 72, "text": "", "type": "break"},
            {"time": 74, "text": "[Bridge]", "type": "section"},
            {"time": 76, "text": "And when the world is falling down around us", "type": "line"},
            {"time": 80, "text": "We find our shelter in the sound", "type": "line"},
            {"time": 84, "text": "", "type": "break"},
            {"time": 86, "text": "[Outro]", "type": "section"},
            {"time": 88, "text": "The music never dies...", "type": "line"},
        ],
        "chords": generate_chords("Am", "pop", 92),
    }


def parse_lrc(synced_raw: str) -> list:
    """Parse LRC format synced lyrics."""
    lyrics_lines = []
    for line in synced_raw.strip().split("\n"):
        line = line.strip()
        if not line or not line.startswith("[") or "]" not in line:
            continue
        ts_end = line.index("]")
        ts_str = line[1:ts_end]
        text = line[ts_end + 1:].strip()
        try:
            parts = ts_str.split(":")
            time_s = int(parts[0]) * 60 + float(parts[1])
        except (ValueError, IndexError):
            continue
        if not text:
            lyrics_lines.append({"time": time_s, "text": "", "type": "break"})
        elif text.startswith("[") and text.endswith("]"):
            lyrics_lines.append({"time": time_s, "text": text[1:-1], "type": "section"})
        else:
            lyrics_lines.append({"time": time_s, "text": text, "type": "line"})
    return lyrics_lines


def parse_plain(plain_raw: str) -> list:
    lines = [ln.strip() for ln in plain_raw.strip().split("\n")]
    lyrics_lines = []
    t = 0
    for ln in lines:
        if not ln:
            lyrics_lines.append({"time": t, "text": "", "type": "break"})
        else:
            lyrics_lines.append({"time": t, "text": ln, "type": "line"})
        t += 3.5
    return lyrics_lines


@router.get("/songs/{song_id}/lyrics")
async def get_lyrics(song_id: str):
    song = await db.songs.find_one({"id": song_id}, {"_id": 0})
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    title, artist, genre = song.get('title', ''), song.get('artist', ''), song.get('genre', '')
    try:
        params = {"track_name": title, "artist_name": artist}
        async with httpx.AsyncClient(timeout=8) as c:
            resp = await c.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                duration = data.get("duration", 92)
                synced_raw = data.get("syncedLyrics") or ""
                plain_raw = data.get("plainLyrics") or ""
                key = detect_key(genre, title)
                chords = generate_chords(key, genre, duration or 92)
                if synced_raw:
                    lines = parse_lrc(synced_raw)
                    if lines:
                        return {"success": True, "song_id": song_id, "title": title, "artist": artist,
                            "lyrics": lines, "chords": chords, "synced": True, "source": "lrclib", "key": key}
                elif plain_raw:
                    lines = parse_plain(plain_raw)
                    if lines:
                        return {"success": True, "song_id": song_id, "title": title, "artist": artist,
                            "lyrics": lines, "chords": chords, "synced": False, "source": "lrclib", "key": key}
    except Exception as e:
        logger.warning(f"LRCLIB fetch failed: {e}")
    mock_data = get_mock_lyrics(title, artist)
    return {"success": True, "song_id": song_id, "title": title, "artist": artist, **mock_data, "synced": False, "source": "mock"}


@router.get("/lyrics/search")
async def search_lyrics(track: str, artist: str = ""):
    try:
        params = {"track_name": track}
        if artist:
            params["artist_name"] = artist
        async with httpx.AsyncClient(timeout=8) as c:
            resp = await c.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                return {"success": True, "has_synced": bool(data.get("syncedLyrics")), "has_plain": bool(data.get("plainLyrics")),
                    "track_name": data.get("trackName", ""), "artist_name": data.get("artistName", ""), "duration": data.get("duration", 0)}
            return {"success": False, "message": "Not found on LRCLIB"}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/lyrics/fetch")
async def fetch_lyrics_direct(track: str, artist: str = ""):
    try:
        params = {"track_name": track}
        if artist:
            params["artist_name"] = artist
        async with httpx.AsyncClient(timeout=8) as c:
            resp = await c.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                duration = data.get("duration", 92)
                key = detect_key("", track)
                chords = generate_chords(key, "", duration or 92)
                synced_raw = data.get("syncedLyrics") or ""
                plain_raw = data.get("plainLyrics") or ""
                if synced_raw:
                    lines = parse_lrc(synced_raw)
                    if lines:
                        return {"success": True, "title": data.get("trackName", track), "artist": data.get("artistName", artist),
                            "lyrics": lines, "chords": chords, "synced": True, "source": "lrclib", "key": key}
                elif plain_raw:
                    lines = parse_plain(plain_raw)
                    if lines:
                        return {"success": True, "title": data.get("trackName", track), "artist": data.get("artistName", artist),
                            "lyrics": lines, "chords": chords, "synced": False, "source": "lrclib", "key": key}
    except Exception as e:
        logger.warning(f"LRCLIB direct fetch failed: {e}")
    mock_data = get_mock_lyrics(track, artist)
    return {"success": True, "title": track, "artist": artist, **mock_data, "synced": False, "source": "mock"}


# --- Chord lookup endpoint ---
@router.get("/chords/lookup")
async def chord_lookup(track: str = "", artist: str = "", genre: str = "", duration: float = 92):
    """Get guitar chords for a song based on music theory."""
    key = detect_key(genre, track)
    chords = generate_chords(key, genre, duration)
    return {"success": True, "key": key, "chords": chords, "track": track, "artist": artist}
