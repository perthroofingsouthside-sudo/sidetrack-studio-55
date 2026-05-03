# SIDETRACK — Production-Ready PRD

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK. Full feature set: song recognition, streaming, stem separation, stem mixer, guitar chords + lyrics, recording, Cover Battles, Playlists, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles, Pro Tiers with Stadium VIP.

## Architecture (Refactored)
```
/app/backend/
  server.py          # App setup, route registration, WebSocket, Band Cron scheduler
  database.py         # MongoDB connection
  config.py           # API keys, constants
  models.py           # All Pydantic models
  routes/
    core.py           # Health, root
    songs.py          # Recognition, stems, recordings
    lyrics.py         # LRCLIB lyrics, chord engine, chord lookup
    music.py          # iTunes streaming, skips
    community.py      # Battles, playlists, duets, stars, challenges
    platform.py       # Subscriptions, band downgrade, trim, chat, social, rewards, discovery, sync
```

## Band Auto-Downgrade Cron System
- **Schedule**: Every Sunday at 00:00 UTC via asyncio background task
- **Logic**: Scans all band subs (adult_band, under18_band) not already downgraded
- **Requirement**: 1+ upload in preceding 7 days
- **Action on failure**: status→"downgraded", price→$11.98 (Individual rate), stores previous_tier + previous_price + downgrade_reason
- **Audit**: Every check logged to `band_audit_log` with per-user entries and run summaries
- **Admin endpoints**: GET /api/subscriptions/band-audit, GET /api/subscriptions/band-audit/summary
- **Idempotent**: Already-downgraded users excluded from subsequent runs

## All Implemented Features
- [x] Shazam song recognition + Replicate Demucs AI stem separation
- [x] iTunes streaming with 50 skip/day limit
- [x] LRCLIB synced lyrics with neon green glow + auto-scroll
- [x] Music-theory chord engine (11 keys x 9 genres)
- [x] SVG guitar chord diagrams
- [x] Interactive Fan Mixer: Mute/Solo/Artist Presets
- [x] Cover Battles with voting + leaderboard
- [x] Duet Mode recording
- [x] Become a Star karaoke + Weekly Challenges (Wed-Wed)
- [x] Playlists (public/private CRUD)
- [x] Live Stage with camera/lyrics/guitar/split layouts
- [x] Stadium WebSocket Chat (real-time, persisted, VIP badges)
- [x] Social profiles: follows, likes, live stats
- [x] 7 subscription tiers including Stadium VIP ($4.98/mo)
- [x] **Scheduled Band Auto-Downgrade Cron (Sunday 00:00 UTC)**
- [x] **Full audit trail in band_audit_log collection**
- [x] Competition winner auto-credit (1 month Pro)
- [x] Real audio trimming via pydub/ffmpeg
- [x] Vibe-Match personalized discovery
- [x] Global Sync master clock + jam rooms
- [x] SIDETRACK Orange/Green/Dark branding (100%)

## Remaining
- [ ] Stripe payments integration
