# SIDETRACK Studios - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK Studios. Features: song recognition, music streaming, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), and Star Challenges.

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
- [x] Replicate Demucs stem separation (WORKING)
- [x] Stem Mixer (4-track: vocals/guitar/bass/drums) with mute/solo
- [x] Split Screen: Guitar chords + Lyrics (MOCKED data)
- [x] Audio recording mode + Video recording mode
- [x] 4 Flexible Recording Layouts: Camera, Split, Lyrics, Guitar (top/bottom horizontal)
- [x] Social live feed links in Recording Studio (TikTok Live, IG Live, YouTube Live)
- [x] Waveform trim editor
- [x] Social media sharing (Instagram, TikTok, Twitter/X, YouTube)
- [x] 7-tab navigation (Stream, Discover, Battle, Star, Playlists, Studio, Record)
- [x] SIDETRACK Studios branding with dark neon theme
- [x] Cover Battle arena with voting and leaderboards
- [x] Playlists (public/private) with full CRUD + Add-to-Playlist from Stream
- [x] Mobile overflow fix + landscape mode CSS support
- [x] Duet Mode: Record side-by-side with covers from Battle Arena
- [x] Become a Star: Karaoke with song search, 3 layouts, star feed, voting, leaderboard
- [x] Star Challenges: Wednesday-to-Wednesday weekly themed challenges, optional join, Star of the Week, past challenges history

## DB Collections
- songs, recordings, battles, covers, playlists, duets, stars, challenges

## Key API Endpoints
- POST /api/recognize (Shazam), POST /api/songs/{id}/separate (Demucs)
- GET /api/stream/search, GET /api/music/search (iTunes)
- CRUD: /api/battles, /api/playlists, /api/duets, /api/stars
- GET /api/challenges/current, GET /api/challenges/{id}/entries, GET /api/challenges/history

## What's Still MOCKED
- **Lyrics & Guitar Chords**: GET /api/songs/{id}/lyrics returns mock data. Needs real Musixmatch or Genius API.

## Prioritized Backlog
### P1
- [ ] Real lyrics via Musixmatch API (requires free API key from user)

### P2
- [ ] Audio/Video editing/trimming feature before social sharing
- [ ] Social user profiles (battle stats, shared playlists, duet/star history)
