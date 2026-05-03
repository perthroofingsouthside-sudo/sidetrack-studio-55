# SIDETRACK — Production-Ready PRD

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK. Full feature set: song recognition, streaming, stem separation, stem mixer, guitar chords + lyrics, recording, Cover Battles, Playlists, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles, Pro Tiers with Stadium VIP.

## Architecture (Refactored)
```
/app/backend/
  server.py          # 75 lines — app setup + route registration
  database.py         # MongoDB connection
  config.py           # API keys, constants
  models.py           # All Pydantic models
  routes/
    core.py           # Health, root
    songs.py          # Recognition, stems, recordings
    lyrics.py         # LRCLIB lyrics, chord engine, chord lookup
    music.py          # iTunes streaming, skips
    community.py      # Battles, playlists, duets, stars, challenges
    platform.py       # Subscriptions, trim, chat, social, rewards, discovery, sync
```

## All Implemented Features
- [x] Shazam song recognition + Replicate Demucs AI stem separation
- [x] iTunes streaming with 50 skip/day limit
- [x] LRCLIB synced lyrics with neon green glow + auto-scroll
- [x] Music-theory chord engine (11 keys x 9 genres, diatonic progressions)
- [x] SVG guitar chord diagrams with glowing finger dots
- [x] Interactive Fan Mixer: Mute/Solo/Artist Presets (Vocal Focus, Band Only, Full Mix, Drums & Bass)
- [x] Cover Battles with voting + leaderboard
- [x] Duet Mode recording
- [x] Become a Star karaoke feed + Weekly Challenges (Wed-Wed)
- [x] Playlists (public/private CRUD)
- [x] Live Stage with camera/lyrics/guitar/split layouts
- [x] Stadium WebSocket Chat (real-time, persisted, VIP badges)
- [x] Social profiles: follows, likes, live stats from DB
- [x] 7 subscription tiers including Stadium VIP ($4.98/mo)
- [x] Active Band auto-downgrade (no upload in 7 days → status=downgraded)
- [x] Competition winner auto-credit (1 month Pro)
- [x] Real audio trimming via pydub/ffmpeg
- [x] Vibe-Match personalized discovery (async httpx)
- [x] Global Sync master clock + jam rooms
- [x] SIDETRACK Orange/Green/Dark branding (100%)

## Remaining
- [ ] Stripe payments integration
- [ ] Schedule band auto-downgrade as cron job
