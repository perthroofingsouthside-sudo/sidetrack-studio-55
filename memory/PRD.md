# SIDETRACK Studios - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK Studios. Features: song recognition, music streaming (search/browse/play), stem separation (vocals/guitar/bass/drums), stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, and shared listening (two phones synced).

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB + Replicate (Demucs)
- **Music API**: iTunes Search API (no keys needed)
- **Stem Separation**: Replicate Demucs (WORKING)
- **Song Recognition**: Shazam via RapidAPI

## What's Been Implemented
- [x] Music streaming page with real iTunes Top Albums and Top Songs
- [x] Song search returning real tracks with 30-second previews
- [x] Audio playback with now-playing mini bar
- [x] Song recognition (Shazam with demo fallback)
- [x] Replicate Demucs stem separation (WORKING - billing active)
- [x] Stem Mixer (4-track: vocals/guitar/bass/drums) with mute/solo
- [x] Split Screen: Guitar chords + Lyrics (mock data)
- [x] Audio recording mode + Video recording mode
- [x] Waveform trim editor
- [x] Social media sharing (Instagram, TikTok, Twitter/X, YouTube)
- [x] 5-tab navigation (Stream, Discover, Studio, Record, Share)
- [x] SIDETRACK Studios branding with dark neon theme

## Prioritized Backlog
### P0
- [ ] Shared listening feature (Listen Together rooms)
- [ ] Real lyrics via Genius/Musixmatch APIs

### P1
- [ ] Full Spotify integration (when user gets Client ID/Secret)
- [ ] Audio mixing: merge user recording with stems for export

### P2
- [ ] User accounts
- [ ] Saved recordings library
- [ ] Playlist creation
