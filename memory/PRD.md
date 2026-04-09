# SIDETRACK Studios - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK Studios. Features: song recognition, music streaming (search/browse/play), stem separation (vocals/guitar/bass/drums), stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists (public/private), flexible recording layouts (top/bottom horizontal), and social live feed options.

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
- [x] 4 Flexible Recording Layouts: Camera, Split (Camera+Lyrics), Lyrics, Guitar (top/bottom horizontal)
- [x] Social live feed links in Recording Studio (TikTok Live, IG Live, YouTube Live)
- [x] Waveform trim editor
- [x] Social media sharing (Instagram, TikTok, Twitter/X, YouTube)
- [x] 6-tab navigation (Stream, Discover, Battle, Playlists, Studio, Record)
- [x] SIDETRACK Studios branding with dark neon theme
- [x] Cover Battle arena with voting and leaderboards
- [x] Playlists (public/private) with full CRUD
- [x] Add-to-Playlist from Stream page search results
- [x] Mobile overflow fix (no horizontal scroll at 375px)
- [x] Landscape mode CSS support

## Prioritized Backlog
### P1
- [ ] Real lyrics via Genius/Musixmatch APIs (currently mocked)

### P2
- [ ] Audio/Video editing/trimming feature before social sharing
- [ ] Social user profiles (battle stats, shared playlists)
