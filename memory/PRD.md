# AuraSplit - Music Recognition & Creation App

## Original Problem Statement
Build a music app like Shazam that can find songs. After identification, allow users to separate vocals and instruments (stems). Users can mute specific stems and record themselves over the backing track. Features include lyrics display with chord progressions (default split screen: guitar + lyrics), audio-only and video recording modes, cut/editing features, and social media sharing.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **APIs**: Shazam (RapidAPI), Replicate (Demucs), Genius, Musixmatch

## User Personas
1. **Musicians** - Want to learn songs, see chords, and practice along
2. **Content Creators** - Want to create covers and share on social media
3. **Music Enthusiasts** - Want to identify songs and explore their components

## Core Requirements (Static)
- Song recognition via audio capture
- Multi-track stem separation (vocals, guitar, bass, drums)
- Split-screen chord + lyrics view
- Audio and video recording over backing tracks
- Recording editing (trim/cut)
- Social media sharing

## What's Been Implemented (2026-04-08)
- [x] Home page with "Tap to Recognize" button and animated radar rings
- [x] Shazam API integration for song recognition (with demo fallback)
- [x] Player Studio with song info display
- [x] Stem Mixer with 4 vertical sliders (vocals, guitar, bass, drums) + mute toggles
- [x] Split Screen: Guitar chords panel + Lyrics panel with synchronized scrolling
- [x] Chord diagram visualizations
- [x] Audio-only recording mode (MediaRecorder API)
- [x] Video recording mode (camera + audio)
- [x] Waveform editor with trim controls
- [x] Social media share buttons (Instagram, TikTok, Twitter/X, YouTube)
- [x] Download recording functionality
- [x] Bottom navigation bar (Discover, Studio, Record, Share)
- [x] Dark neon theme (black, indigo, violet)
- [x] MongoDB storage for songs and recordings
- [x] Full CRUD API for songs and recordings

## MOCKED Features
- **Stem Separation**: Returns mock URLs (needs REPLICATE_API_TOKEN)
- **Lyrics/Chords**: Returns mock data (needs Genius/Musixmatch API keys)
- **Playback**: Simulated playback timer (no actual audio playback of stems)

## Prioritized Backlog
### P0 (Critical)
- [ ] Real Shazam API key (current one may be truncated)
- [ ] Replicate API integration for actual stem separation
- [ ] Real lyrics fetching via Genius/Musixmatch APIs

### P1 (High)
- [ ] Audio playback with actual stem mixing (Web Audio API)
- [ ] Actual audio/video mixing (merge recording with backing track)
- [ ] Backend video processing with FFmpeg

### P2 (Medium)
- [ ] Song history/library page
- [ ] More chord diagrams for all common chords
- [ ] Better waveform visualization
- [ ] Export in different formats (MP4, MP3)
- [ ] User accounts and saved recordings

## Next Tasks
1. Get full API keys from user and integrate real Shazam recognition
2. Integrate Replicate Demucs for actual stem separation
3. Add Web Audio API for real-time stem mixing and playback
4. Integrate Genius/Musixmatch for real lyrics + chords
5. Add FFmpeg backend processing for audio/video mixing
