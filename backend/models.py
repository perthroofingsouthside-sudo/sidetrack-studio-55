"""Pydantic models for Pocket Products backend."""
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone


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


class BattleCreate(BaseModel):
    song_title: str
    song_artist: str = ""
    song_cover_url: str = ""
    challenge_text: str = ""


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


class SubscriptionSelect(BaseModel):
    user_id: str
    tier_key: str


class TrimRequest(BaseModel):
    recording_id: str = ""
    start_pct: float = 0
    end_pct: float = 100


class FollowAction(BaseModel):
    follower_id: str
    following_id: str
