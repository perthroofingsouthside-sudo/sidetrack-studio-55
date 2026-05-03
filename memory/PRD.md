# SIDETRACK - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK. Features: song recognition, music streaming with daily skip limits, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB + Replicate (Demucs)
- **Music API**: iTunes Search API (no keys needed)
- **Stem Separation**: Replicate Demucs (WORKING)
- **Song Recognition**: Shazam via RapidAPI
- **Lyrics**: LRCLIB API (synced lyrics, free, no key needed)

## Color Scheme
- Primary: Neon Orange (#FF6B00)
- Secondary: Neon Green (#39FF14)
- Dark bg: #05050A, Surface: #0F0F16 / #12121A

## What's Been Implemented
- [x] **SIDETRACK branding** (logo, gradient icon, prominent in Dashboard + Live Stage)
- [x] **Daily Skip Limiter**: 50 skips/day per user, resets midnight UTC. Skip counter pill in now-playing bar with color coding (green/orange/red). Tooltip + disabled state when exhausted.
- [x] Neon Orange / Neon Green color scheme (all files)
- [x] LRCLIB API integration for real synced lyrics
- [x] Social Profile page placeholder
- [x] Polished Stream dashboard (hero, neon progress, crystal-glass)
- [x] Live Stage Recording Studio (glassmorphism, ambient, LiveChat sidebar)
- [x] LiveChat component (Live + Comments modes)
- [x] iTunes streaming, search, Top Albums/Songs
- [x] Shazam song recognition + Replicate Demucs stems
- [x] Stem Mixer, Cover Battles, Duet Mode
- [x] Become a Star karaoke + Star Challenges (Wed-Wed)
- [x] Playlists (public/private CRUD) + 8-tab navigation

## DB Collections
songs, recordings, battles, covers, playlists, duets, stars, challenges, skip_counters

## What's Still MOCKED
- Guitar chords (mock data)
- LiveChat messages (client-side mock)

## Prioritized Backlog
### P2
- [ ] Full A/V editing/trimming workflow
- [ ] Social Profile: live stats from DB
- [ ] WebSocket backend for LiveChat
