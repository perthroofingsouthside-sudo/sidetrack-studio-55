# SIDETRACK Studios - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK Studios. Features: song recognition, music streaming, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, and Live Chat.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB + Replicate (Demucs)
- **Music API**: iTunes Search API (no keys needed)
- **Stem Separation**: Replicate Demucs (WORKING)
- **Song Recognition**: Shazam via RapidAPI

## What's Been Implemented
- [x] Polished Stream page: hero section, neon progress bar, crystal-glass now-playing, bento layout
- [x] "Live Stage" Recording Studio: immersive stage redesign, glassmorphism controls, ambient stage bg
- [x] LiveChat component: Live/Comments dual modes, retro-terminal styling, integrated in Stream + Live Stage
- [x] Updated CSS: crystal-glass, retro-terminal, neon-progress, stage-ambient, neon-ambient-glow
- [x] Music streaming with real iTunes Top Albums and Top Songs
- [x] Song search with 30-second previews + now-playing bar
- [x] Song recognition (Shazam with demo fallback)
- [x] Replicate Demucs stem separation (WORKING)
- [x] Stem Mixer (4-track: vocals/guitar/bass/drums) with mute/solo
- [x] Split Screen: Guitar chords + Lyrics (MOCKED data)
- [x] 4 Flexible Recording Layouts: Camera, Split, Lyrics, Guitar (top/bottom horizontal)
- [x] Social live feed links (TikTok Live, IG Live, YouTube Live)
- [x] Waveform trim editor + social media sharing
- [x] 7-tab navigation (Stream, Discover, Battle, Star, Playlists, Studio, Record)
- [x] Cover Battle arena with voting, leaderboards, and Duet Mode
- [x] Playlists (public/private) with full CRUD + Add-to-Playlist from Stream
- [x] Become a Star: Karaoke with song search, 3 layouts, star feed, voting, leaderboard
- [x] Star Challenges: Wednesday-to-Wednesday weekly themed challenges, Star of the Week

## DB Collections
- songs, recordings, battles, covers, playlists, duets, stars, challenges

## What's Still MOCKED
- **Lyrics & Guitar Chords**: GET /api/songs/{id}/lyrics returns mock data
- **LiveChat**: Client-side mock messages (no WebSocket backend yet)

## Prioritized Backlog
### P1
- [ ] Real lyrics via Musixmatch API (requires free API key from user)

### P2
- [ ] Audio/Video editing/trimming before social sharing
- [ ] Social user profiles (battle stats, playlists, duet/star history)
- [ ] Real-time WebSocket backend for LiveChat
