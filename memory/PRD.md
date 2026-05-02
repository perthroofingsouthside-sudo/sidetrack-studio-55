# SIDETRACK Studios - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK Studios. Features: song recognition, music streaming, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles.

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
- Text: #8F8F9D (body), #5C5C6B (muted)

## What's Been Implemented
- [x] Full color scheme: Neon Orange / Neon Green on dark (across ALL files)
- [x] LRCLIB API integration for real synced lyrics (with mock fallback)
- [x] Social Profile page placeholder (stats grid, activity feed, edit name)
- [x] Edit & Share page (waveform trim, social sharing)
- [x] 8-tab navigation (Stream, Discover, Battle, Star, Playlists, Profile, Studio, Record)
- [x] Polished Stream dashboard (hero, neon progress bar, crystal-glass surfaces)
- [x] Live Stage Recording Studio (glassmorphism, stage ambient, LiveChat sidebar)
- [x] LiveChat component (Live + Comments dual mode)
- [x] iTunes streaming, search, Top Albums/Songs
- [x] Shazam song recognition
- [x] Replicate Demucs stem separation (WORKING)
- [x] Stem Mixer (4-track with mute/solo)
- [x] Cover Battle arena + Duet Mode
- [x] Become a Star karaoke + Star Challenges (Wed-Wed)
- [x] Playlists (public/private CRUD) + Add-to-Playlist

## DB Collections
songs, recordings, battles, covers, playlists, duets, stars, challenges

## What's Still MOCKED
- Guitar chords (chord progressions are mock data)
- LiveChat messages (client-side mock, no WebSocket backend)

## Prioritized Backlog
### P2
- [ ] Full Audio/Video editing/trimming workflow before sharing
- [ ] Social Profile: live stats from DB (battles won, star count, etc.)
- [ ] WebSocket backend for LiveChat
