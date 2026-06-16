# Pocket Products — Launch-Ready PRD

## Original Problem Statement
Shazam-style music app where users find songs, separate stems (vocals/instruments), and record themselves over the muted parts. Rebranded from **SIDETRACK** to **Pocket Products**. Neon Orange (#FF6B00) + Electric Green (#39FF14) on dark theme.

## Architecture
```
/app/backend/
  server.py            # App setup, WebSocket, Band Cron, route registration
  database.py          # MongoDB connection
  config.py            # API keys, constants
  models.py            # Pydantic models
  routes/
    core.py            # Health
    songs.py           # Recognition, stems, recordings
    lyrics.py          # LRCLIB, chord engine
    music.py           # iTunes streaming, skips
    community.py       # Battles, playlists, duets, stars, challenges
    platform.py        # Subscriptions (w/ ownership gate), bands, social, discovery, chat
    payments.py        # Stripe checkout, ownership lifecycle
    connect.py         # DMs, video calls
    studio_ai.py       # Beat Maker + AI Audio Cleanup (mocks)
/app/frontend/src/
  App.js               # Router + Global Audio
  index.css            # Neon/Glass design tokens, avatar-ring CSS
  components/
    GlobalPlayer.js, BottomNav.js, LiveChat.js, StemMixer.js,
    AvatarRing.js,    # useAudioActivity + ring (orange default → green on voice)
    BeatMaker.js      # Studio AI tool with genre/bpm/bars/key controls
  pages/
    HomePage, PlayerStudio (+ BeatMaker), RecordingStudio (+ AvatarRing + Live Cleanup),
    PricingPage (+ OwnershipHero + lock overlays), BattleArena, BecomeAStar,
    ConnectPage, PlaylistsPage, DuetStudio, SocialProfile, EditSharePage, StreamPage
```

## Ownership Model (NEW — Feb 2026)
- **One-time**: $79.98 AUD → permanent unlock ("Unlock the Creator Ecosystem")
- **Finance**: $9.99 AUD/mo × 12 (total $119.88 AUD) → progressive unlock, owned on payment 12
- **Locked tiers** (require ownership): `student`, `family`, `adult_band`, `under18_band`, `couple_duo`
- **Always available**: `listener` ($4.98 USD), `individual` ($11.98 USD), `individual_covers` ($15.98 USD), `covers_addon` ($5.98 USD)
- DB: `db.ownership` per user — `{status: none|financing|owned, method, payments_made, payments_required:12, total_paid, currency:"aud"}`
- Backend gate: 403 on `/subscriptions/select` and `/payments/checkout` for locked tiers when not owned
- Frontend: lock overlay on TierCard, OwnershipHero with Buy Once / Subscribe to Own CTAs + progress bar

## Subscription Tiers (USD month)
| Key | Price | Locked? |
|---|---|---|
| listener | $4.98 | No |
| individual | $11.98 | No |
| individual_covers | $15.98 | No |
| student | $9.98 | **Yes** |
| couple_duo | $14.98 | **Yes** |
| family | $20.98 | **Yes** |
| adult_band | $17.98 | **Yes** |
| under18_band | $2.98 | **Yes** |
| covers_addon | $5.98 | No (add-on) |

## Revenue
- Pay-per-song: $0.79 with **70% artist / 30% platform** split (db.purchases tracks splits)
- Subscription bands: weekly upload cron audit (Sundays UTC), auto-downgrade if inactive

## Studio AI (Mocked — Feb 2026)
- **Make a Beat**: `POST /api/studio/beat/generate` — 4 whitelisted genres: `mtv_classic`, `ministry_of_sound`, `hip_hop_top200`, `alt_rock`. Returns kick/snare/hihat/bass arrays + preview URL.
- **AI Audio Cleanup**: `POST /api/studio/cleanup` — modes: rock | vocal | instrumental, `live=true` for stream pipeline.
- **Avatar Active Glow**: Web Audio API AnalyserNode → 0-1 intensity drives green outer ring glow on host + viewer lead during recording.

## Catalog Pivot Constraints
Only the 4 whitelisted genres are exposed in Beat Maker + Battle of the Bands. Backend enforces via `ALLOWED_GENRES`.

## Stripe Payment Flow
1. User clicks tier or ownership product → `POST /api/payments/checkout`
2. Backend validates tier/ownership, creates Stripe session (USD for subs, AUD for ownership)
3. Webhook + polling `GET /api/payments/status/{session_id}` activates sub OR credits ownership
4. Ownership full → instant `is_owned=true`. Ownership finance → increment counter, mark owned at 12.

## All Completed Features
- ✅ Shazam recognition + Replicate Demucs stems
- ✅ iTunes streaming, 30s preview indicator, 50 skips/day
- ✅ LRCLIB synced lyrics + chord engine
- ✅ Interactive Stem Mixer
- ✅ Cover Battles, Duets, Become a Star, Weekly Challenges
- ✅ Playlists, Live Stage, Stadium WebSocket Chat
- ✅ Social profiles, follows, likes, live stats
- ✅ 9-tier subscription model + Ownership unlock gate
- ✅ Stripe Checkout (USD subs + AUD ownership)
- ✅ Band Auto-Downgrade Cron (Sunday 00:00 UTC) + audit
- ✅ Competition winner auto-credit
- ✅ Real audio trimming (pydub/ffmpeg)
- ✅ Vibe-Match personalized discovery
- ✅ Pocket Products rebrand + Neon Orange/Green theme
- ✅ Persistent Global Audio Player
- ✅ Connect (DMs + Video call UI)
- ✅ Live Stage Stadium (1+4) + Viewer cinematic layouts with glassmorphism
- ✅ Avatar Ring active glow (Web Audio API)
- ✅ Live AI Cleanup toggle in Live Stage
- ✅ Make-a-Beat Studio AI tool
- ✅ Catalog Pivot whitelist (MTV / MOS / Hip-Hop / Alt-Rock)
- ✅ Ownership Model with discount-tier gating

- ✅ **Feb 16, 2026 — CODE QUALITY PASS**:
  - 9 empty catch blocks → all log errors via `console.error` / `console.debug` (PlaylistsPage, HomePage, BattleArena ×2, SyncHUD ×2, StemMixer, JamRoomPanel)
  - **Security**: removed `random` module from `studio_ai.py` entirely — beat generation now uses `hashlib.sha256` deterministic byte stream (verified: same input → identical kick pattern across calls)
  - **Test hygiene**: removed all `is True` / `is False` from 5 test files (29 instances) → bare `assert x` / `assert not x` per pytest idiom; `is None` preserved per PEP 8
  - **Zero `console.log`** statements in production code (only `console.error`/`console.debug` for monitoring)
  - Regression: 34/34 backend tests (iter-20 + iter-21) still PASS; `CI=true yarn build` clean

## Pending / Backlog (P2)
- ✅ **Feb 16, 2026 — CODE QUALITY PASS 2**:
  - 98 ruff blocking errors auto-fixed: 34 E701 multi-statement lines (`community.py`, `platform.py` reformatted), 53 `== True/False` in test files → idiomatic truth checks, 6 unused f-strings stripped
  - Memoized `upcomingChords` in `RecordingStudio.js` (was filter+slice on every tick = ~10 Hz wasted CPU during playback)
  - Hoisted `BAR_OPTIONS` + `KEY_OPTIONS` to module scope in `BeatMaker.js` (avoid per-render array allocation)
  - Added `utils/log.js` shim — `log.debug()` no-ops in production; replaced 5 `console.debug` callers (`JamRoomPanel`, `SyncHUD`, `StemMixer`)
  - Type-hinted `routes/core.py` (previously 0% → 100%)
  - Regression: 34/34 backend tests still PASS; `CI=true yarn build` clean
- ✅ **Feb 16, 2026 — REFACTOR COMPLETE**:
  - `PlayerStudio.js` 866 → 432 lines (extracted `StudioSearchScreen`, `ChordDots`, `formatTime`)
  - `RecordingStudio.js` 734 → 528 lines (extracted `TrimModal`, `RecordSearchScreen`, `GuitarDiagram`)
  - New modules: `components/studio/{StudioSearchScreen,ChordDots}.js`, `components/recording/{TrimModal,RecordSearchScreen,GuitarDiagram}.js`, `utils/format.js`
  - All 5 React hook-dependency warnings fixed — `CI=true yarn build` compiles with **ZERO warnings**.
- ✅ **Feb 16, 2026 — P1 IMMERSIVE DISCOVER**: `NowPlayingHero` component on Discover. When a track is playing, the page transforms into a full-bleed blurred-album-art hero with vinyl-style cover, title/artist, neon gradient seek bar, mic/play-pause/search controls and "Open in Studio" CTA. `[hero-search-btn]` overlays the original search layout with a `[back-to-now-playing]` pill. Self-tested live: hero re-appears with new track metadata when user picks a 2nd track. (`/app/test_reports/iteration_23.json`)
- ✅ **Feb 16, 2026 — P2 HYGIENE**: Deduplicated `LOCKED_TIERS` (now imported from `routes.platform` in `payments.py`). Added MongoDB TTL indexes (`expireAfterSeconds=2592000`) on `beats.created_at` and `cleanup_jobs.created_at` via `server.py` startup hook.
- Refactor `BecomeAStar.js` (732 lines, complexity 119) — not reachable from nav after lane restructure. LOW priority.
- Wire real AudioCraft/Suno engine into `/studio/beat/generate` (currently mocked)
- Wire real DSP into `/studio/cleanup` (currently returns profile only)
- Un-mock WebRTC P2P video in `JamRoomPanel` — requires real signaling server
- Real OAuth (YouTube/TikTok) integration in `PublishPanel` — requires user-provided OAuth credentials

## Testing
- `/app/backend/tests/test_iteration20_ownership.py` — 17 tests, 100% pass
- `/app/test_reports/iteration_20.json` — backend 100%, frontend pricing 100%, BeatMaker + RecordingStudio self-tested via screenshots (avatar-ring count=5, live-cleanup-toggle visible, beat-maker mounts on track load).
