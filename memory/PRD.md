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

- ✅ **Feb 16, 2026 — BATTLE STAGE ENHANCEMENTS**:
  - **4-skin Stage Picker**: Theater (red velvet, classic), Rock Arena (purple lasers + violet curtains), Outer Space (starfield + nebula curtains), Underwater (vertical-drape cyan curtains + rising bubbles). Persisted to `localStorage.pp_stage_skin`. New testids: `stage-skin-toggle`, `stage-skin-picker`, `stage-skin-{theater|arena|space|ocean}`.
  - **Scrolling artist marquee strip** under the title — auto-pulls unique artists from active battles + leaderboard, falls back to "Pocket Products / Live Tonight / Take The Mic / Karaoke Stars" when empty. 28s linear loop, edge gradients for clean fade.
  - **Pulsing footlights** along the front edge of every stage — 12 alternating orange+green (or skin-themed) cones, `footlightPulse` 1.6s ease-in-out staggered animation.
  - New CSS keyframes: `footlightPulse`, `oceanBubble`, `marqueeScroll`. Skin-specific decorative layers: 60-star field (space), 18 rising bubbles (ocean), 4 laser beams (arena).

- ✅ **Feb 16, 2026 — WEBRTC JAM ROOM (un-mocked) + LOCAL DSP BEATS**:
  - **WebRTC video chat (P2P mesh, up to 5 peers)**: new `/api/ws/jam/{code}` WebSocket signaling endpoint in `server.py` — relays `offer`/`answer`/`ice` between peers, broadcasts `peer-joined` / `peer-left`, sends initial `roster` on hello. In-memory `_jam_peers` dict per room with auto-cleanup on disconnect.
  - **Frontend**: `useJamWebRTC` hook (`hooks/useJamWebRTC.js`) + `JamVideoGrid` component (`components/JamVideoGrid.js`). Uses `simple-peer@9.11.1` for the WebRTC transport. ICE servers: Google STUN + Open Relay (metered.ca) free public TURN (3 endpoints — UDP/TCP/443 fallback). Mic/cam toggle controls.
  - **JamRoomPanel** now opt-in: "Start Live Video" button → media-perm request → live tiles. Auto-cleanup on leave.
  - **Smoke-tested** Python WebSocket client: 2-peer roster + peer-joined notifications flow correctly.

  - **Local DSP Beat Synth**: new `services/beat_synth.py` — pure-numpy synthesizer that turns step-patterns into 16-bit PCM mono WAV @ 44.1 kHz. Drum voices: pitch-swept kick (120→50 Hz sine), noise+200 Hz snare, high-pass noise hihat, detuned-saw bass tuned to key. `/api/studio/beat/generate` now returns `preview_url` as `data:audio/wav;base64,...` (~290 KB for 9.6 s @ 100 BPM); `engine: "local_dsp_v1"`. DB stores `preview_url:null` to keep docs light.
  - **BeatMaker UI**: Preview button is now functional (Play/Stop toggle, plays the real synth audio).

- ✅ **Feb 16, 2026 — STADIUM RECORD PAGE + LOGO REFRESH + CONNECT CALL BUTTONS**:
  - **New default Record layout** (`pages/StadiumStudio.js`) — 3-pane stadium UI: vertical stem mixer (Drums/Bass/Keys/Master) w/ neon green dB meters + S/M buttons → centre performance frame w/ live LED + neon-orange animated canvas waveform + fire 🔥/heart ❤️ counters → right pane stadium chat w/ avatar tiles, Fan Level "Legend" XP tracker + "Say something…" bar w/ **Video Call + Voice Call** icons. Mobile (<lg) stacks vertically w/ Mixer/Chat tab switcher.
  - **Bottom synced progress bar** (`fixed bottom: 84px`) — elapsed/total time, gradient seekbar, **BPM 128** orange pill + **KEY E MIN** green pill.
  - "Yesterday" date chip — neon-orange glass-morphism (translucent fill + 1 px orange border + 14 px orange glow + inset glow + 12 px backdrop blur).
  - **Classic toggle** — `pp_record_mode` localStorage flag persists choice; existing `RecordingStudio` Live Stage is reachable via "Classic" pill in stadium header, and the classic Live Stage sidebar now has a "Stadium" gradient pill to swap back.
  - **Logo refresh**: replaced the inline 3-bar SVG monogram on Discover with `/logo.png` (PP monogram, no mouse). Drop-shadow neon glow preserved.
  - **Connect message bar**: added Video Call (green) + Voice Call (orange) icon buttons to the left of the chat input; `startCall(user, { video })` now respects the video flag (voice-only doesn't request camera).
  - All testids exposed: `stadium-studio`, `stadium-header`, `date-chip`, `switch-classic-btn`, `stadium-song-title`, `stadium-song-artist`, `fire-count`, `heart-count`, `stem-mixer`, `stem-{drums|bass|keys|master}{,-slider,-db,-solo,-mute}`, `master-db`, `performance-area`, `stadium-waveform`, `stadium-perform-btn`, `stadium-chat`, `stadium-chat-feed`, `fan-level-tracker`, `say-something(-input|-send)`, `stadium-video-call-btn`, `stadium-voice-call-btn`, `stadium-progress-bar`, `bpm-pill`, `key-pill`, `mobile-tab-{mixer|chat}`, `dm-video-call-btn`, `dm-voice-call-btn`, `switch-stadium-btn`.

- ✅ **Feb 16, 2026 — GAMER CREATION LAB (Bitmoji-style avatar builder)**:
  - New composable SVG character (`components/GamerAvatar.js`) — 240×320 viewBox with layered parts (top → neck → head → face → hair/cap → instrument), radial glow backdrop driven by chosen top color
  - **Customization categories**: Skin Tone (5) · Hair Style (6: short/curly/long/buzz/mohawk/hidden) · Hair Color (6) · Face Expression (3: cool/smile/wow) · Cap (none/baseball/beanie + 4 colors) · Top (hoodie/tee/jacket/vest + 6 colors) · Signature Instrument (6: guitar/bass/drums/mic/keys/dj)
  - New **Creation Lab modal** (`components/CreationLab.js`) — 6 category tabs, live-preview pane (200 px), reset + cancel + neon orange→green gradient "Save Avatar" CTA; mobile-first stacks to single column
  - Profile card now renders the full SVG character (88 px) instead of the previous lone Lucide icon. Verified persistence via `localStorage.pp_gamer_avatar`; live update after save reflects in the profile card
  - **Testids exposed**: `creation-lab`, `creation-lab-preview`, `creation-lab-tabs`, `lab-tab-{skin|hair|face|cap|top|inst}`, `lab-panel-{skin|hair|face|cap|top|inst}`, `skin-{light|warm|tan|brown|deep}`, `hair-{style}`, `hair-color-{hex}`, `face-{cool|smile|wow}`, `cap-{none|cap|beanie}`, `cap-color-{hex}`, `top-{hoodie|tee|jacket|vest}`, `top-color-{hex}`, `inst-{guitar|bass|drums|mic|keys|dj}`, `creation-lab-save`, `creation-lab-cancel`, `creation-lab-reset`, `creation-lab-close`

- ✅ **Feb 16, 2026 — GAMER TRACK CATALOG**:
  - Seed script `scripts/seed_catalog.py` generates `/app/catalog/master_catalog.json` + `/app/catalog/triple_j/{year}.json` for 1990-2025 (250 tracks: 180 Hottest 100 + 70 Top 200 Hip-Hop, all real charting songs). Replace seed file w/ the 3,800-track user export anytime — same schema.
  - **Backend** `routes/gamer_catalog.py` — `GET /api/gamer/catalog/{collections,years,tracks}`. Lazy iTunes Search enrichment populates `cover_url` / `preview_url` / `album` / `duration_ms` on first read, cached in MongoDB `gamer_catalog_enrich`.
  - **New page** `pages/GamerTracksPage.js` — full-screen Gamer-Library: collection picker (Hottest 100 / Top 200 Hip-Hop) · year picker 1990-2025 · debounced search · ranked list w/ iTunes covers · year chips · neon-themed accents per collection (orange / green).
  - **Routing**: Gamer-lane `nav-playlists` → GamerTracksPage; new `case "catalog"` route also renders it (creator can reach via the new "Hottest 100 + Top 200 Hip-Hop · Bonus" CTA on Discover).
  - **Testids exposed**: `gamer-tracks-page`, `collection-picker`, `coll-{hottest_100|hip_hop_top_200}`, `year-picker`, `year-{1990..2025}`, `catalog-search`, `catalog-count`, `catalog-list`, `catalog-empty`, `catalog-track-{i}`, `catalog-track-{i}-year`, `discover-catalog-cta`, `discover-open-catalog`.

- ✅ **Feb 16, 2026 — CODE QUALITY PASS 3 (post-deploy review)**:
  - Verified the **reviewer's "must fix" Python undefined-variable claims are false positives** — `ruff check . --select=F821,F841` returns **All checks passed!** (`checkout_status` and `code` are properly initialised in their respective routes)
  - Verified the **React hook-dep complaints are stale** — `CI=true yarn build` still emits **zero warnings**
  - **Empty catch blocks** in `hooks/useJamWebRTC.js` (3 spots: peer destroy ×2, ws close) → now log via `log.debug` (production-silent shim)
  - **Index-as-key**: 2 flagged spots were 16-segment dB meter + 5 piano keys (static, never reordered) — converted to descriptive keys (`seg-${idx}`, `bk-${x}`) for best practice
  - Backend pytest 34/34 still PASS; production build clean; smoke screenshot confirms Gamer Tracks page intact

- ✅ **Feb 16, 2026 — TRACKS TAB DUAL-MODE PLAYER**:
  - **Play button** (green) per row plays iTunes preview audio in-place; sticky "Now Playing" mini-bar pinned above BottomNav shows current track + Stop + Battle CTA
  - **Battle button** (orange gradient) per row: stops audio immediately, sets `pendingBattleSong` in App state, navigates to Battle Stage. BattleArena auto-creates the battle on mount via `useEffect([pendingBattleSong])` and routes straight into the active GamerStage
  - **Independent use**: catalog page works as a standalone music browser — start/stop multiple previews, browse 250+ seed tracks (3,800+ once you drop in the full catalog), search/filter without ever entering battle
  - **Verified live**: Hottest 100 2025 → Play track #1 → preview plays + Now Playing bar appears → click BATTLE → audio stops, "Battle created!" toast, GamerStage opens with "LOVE WILL TEAR US APART" in header, lyrics rail green, avatar centred, falling notes on right
  - New testids: `catalog-play-{i}`, `catalog-battle-{i}`, `catalog-now-playing`, `catalog-now-playing-title`, `catalog-now-playing-battle`, `catalog-stop-btn`

## Pending / Backlog (P2)
- ✅ **Feb 16, 2026 — BATTLE STAGE REDESIGN** (kid-friendly Gamer-lane experience):
  - Tab renamed: `Battle` → `Battle Stage` (Gamer-lane label only; route key still `battle`)
  - New `components/BattleStageBackdrop.js` — theater backdrop with red side-curtains, perspective stage-floor lines, dual orange+green spotlight cones, 14-slot scattered album-cover scenery (auto-populated from `battles` + `leaderboard`), and animated sparkle "stage dust"
  - `BattleArena.js` list view rebuilt with marquee title ("BATTLE STAGE" in white+neon-orange w/ glow), "ON STAGE TONIGHT" live badge, "TAKE THE STAGE" CTA, "Hall of Fame" + "Tonight's Battles" section headers, "X ON STAGE · LIVE" per battle card, glowing card hover scale
  - New CSS keyframe: `stageDust` (3-axis float + scale + opacity)
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

## Feb 28, 2026 — Discover refined to strict utility
- Rewrote `pages/HomePage.js` (Creator-lane Discover). Strictly Search + Listen + Playlists.
- Removed Mic Shazam, Gamer-catalog CTA, iTunes side rails, "Open in Studio" hero CTA.
- Search now hits `/api/gamer/catalog/tracks?q=...&enrich=true` (3,800-track library).
- Inline "+" → "Add to playlist" picker per result + "Create playlist" inline.
- Default mosaic of catalog covers when no search active.

## Feb 28, 2026 — Rap Battle Hub (Connect tab)
- NEW backend module `/app/backend/routes/battles.py` (router prefix `/api/rap-battles/...`).
  - `POST /register` — join matchmaking queue (auto-pair on each call).
  - `POST /{id}/agree` — both must agree; first_mover = higher lifetime_wins or coin flip.
  - `POST /{id}/go-live` — generates 60-second beat (via `services/beat_synth`) and sets status='live'.
  - `POST /{id}/vote` — 1 vote per voter_id; participants blocked.
  - `POST /{id}/finish` — archives 7 days, increments W/L counters.
  - `GET /archive`, `GET /leaderboard?limit=200`, `GET /tournament/current` (quarterly Top 200).
  - Route ordering fixed; namespace prefix `rap-battles` avoids collision with community `/battles/{id}`.
- NEW frontend components:
  - `components/BattleHub.js` — register card, queue card, active-match card, archive list, tournament card, Top 10 leaderboard.
  - `components/BattleLiveStage.js` — auto-plays the 60s beat (data:audio/wav;base64), countdown, 2s vote polling, finishes on `audio.onended`.
- `pages/ConnectPage.js` — added `[data-testid='open-battle-hub']` CTA + `view='battle-hub'` branch.
- Tested 15/15 backend + full frontend flow (iteration_24).

## Feb 28, 2026 — Record page personalisation + Backstage Cinema wire-up
- `pages/StadiumStudio.js` refactored into **PersonalStudio** behaviour:
  - Stripped Stadium Chat aside, mobile chat tab, fire/heart counters, Fan Level XP tracker, video/voice-call buttons.
  - Replaced right pane with `studio-tools-panel` containing 3 sub-sections:
    - **Stem Upload Queue** — `<input type="file" multiple accept="audio/*">` with playable rows + remove.
    - **AI Beat Maker** — POST `/api/studio/beat/generate` with the correct backend contract `{genre, bpm, bars, key, user_id}`. Genres mapped to backend keys: `hip_hop_top200 / mtv_classic / ministry_of_sound / alt_rock`. Bars selector 4/8/16/32. Returns `beat.preview_url` (WAV data URL) and adds it to the stems list.
    - **Sing to Stems** — `MediaRecorder` with feature-checked webm→mp4 fallback (Safari). Auto-plays the selected stem when recording starts.
  - Kept left vertical stem mixer (Drums/Bass/Keys/Master) + center neon halo/waveform + bottom progress/BPM/Key footer.
- `pages/BackstagePage.js` — injected `backstage-watch-{id}` button on each Kept-tab recording row that opens `<BackstageCinema>` overlay (9-phase intro → playback). Cinema close handler reloads to refresh views/likes counts.
- **Tested**: iteration_27 structural pass 24/24 + 0 page errors. Beat contract validated via curl returning ~700KB WAV data URL.


- NEW `frontend/src/services/SamplerEngine.js` — Web Audio engine:
  - 16 pads, each with buffer + per-pad volume / pitch / ADSR / hi-or-lo-pass filter / stem routing.
  - 4 stem buses (drums / bass / keys / vocals) → master → MediaStreamDestination (for resample) → Hold-FX bus → destination.
  - Hold-FX nodes: stutter (square LFO gate), crush (waveshaper), reverb (synthetic convolution), delay (feedback delay), pitch (modulated delay shimmer).
  - `autoChop(buffer, n)` — RMS-window transient detection slices a buffer into up to N pad-sized chunks.
  - `decodeArrayBuffer` is fail-safe: catches both the legacy error callback AND the modern Promise rejection so corrupt/CORS-blocked audio NEVER triggers the dev runtime overlay.
- NEW `pages/KoalaStudio.js` — UI:
  - Header + Sample Track CTA, 4×4 pad grid with neon-orange active glow and electric-green select ring.
  - Toolbar: mic-sample (start/stop into selected pad), auto-chop, resample master.
  - Hold-FX bar: 5 FX buttons + amount slider.
  - 16-step sequencer with BPM input (40–220), per-pad rows, live step indicator.
  - Side panel: vertical stem mixer (Drums/Bass/Keys/Vocals/Master + per-stem mute) + selected-pad config (stem routing, ADSR, filter, pitch).
  - Search overlay sources from `/api/gamer/catalog/tracks?q=...&enrich=true` (the 3,800-track library); loads previews into the selected pad.
- `App.js` — `case "studio"` now renders `<KoalaStudio>`. Previous `PlayerStudio` parked behind `case "player-studio"`.
- Tested 18/18 frontend flows PASS (iteration_26). Decode-fail toast surfaces cleanly, no runtime overlay.


- `pages/SocialProfile.js` extended with 4 new sections (Identity already existed):
  - Stats Dashboard — Battle Wins/Losses (from `/api/rap-battles/me`), Likes/Views (aggregated from kept recordings).
  - Battle Status — current registration (register CTA / queue / active match) with deep-link to Connect → Battle Hub. Recent battle history rows with W/L/T badge.
  - Personal Playlists — horizontal row of user's saved playlists with Manage → Discover link.
  - My Raps · 60s — kept recordings from `/api/gamer/recordings/{user_id}?status=kept`, with play/pause + likes + views.
- Sub-components `BattleStatusSection`, `PlaylistsSection`, `MyRapsSection` live in-file (588 lines total).
- Tested frontend 8/8 testable flows passed (iteration_25); active-battle card verified via code review.

## Mar 1, 2026 — POST-PITCH POLISH
- **Hold-FX node leak in `SamplerEngine.setMasterFx`** (code-review LOW) — fixed. The setter previously only disconnected the `fxInput → fxDry` edge before re-wiring; the `fxInput → previous-inputNode` edge from the prior FX was never disconnected, so cycling Stutter→Reverb→Delay→Crush accumulated dangling node references. Now `setMasterFx` calls `fxInput.disconnect()` (no args, drops ALL outgoing edges) and re-establishes the dry edge cleanly. Also covers the `kind === "off"` path. Verified live: cycled 4 FX buttons in a row, no console errors, page intact.
- **PricingPage route**: already wired in `ViewRouter.js` (line 161-162, `case "pricing"`). Test agent's iter-33 "not reachable" finding was inaccurate — route exists; only the trigger CTA from Profile is missing, which the user has explicitly deferred ("don't worry about prices what so ever").
- **BecomeAStar.js refactor**: deferred to post-launch backlog per user direction ("these additive's are for if the app bangs"). The page is also not reachable from the current nav after the lane restructure (LOW priority per PRD).

## Mar 1, 2026 — CODE REVIEW BLOCKERS RESOLVED + PITCH DECK
- **3 atomic concurrency fixes in `routes/battles.py`** (code-review HIGH/MED blockers for contest data integrity):
  - **`/finish` race** (HIGH): every spectator's `audio.onended` fired `POST /finish`, multiplying winner's `lifetime_wins`. Now uses an atomic claim — `update_one({status:{$in:["live","agreed"]}}, …)` and credits leaderboard ONLY when `modified_count == 1`. Top-200 leaderboard is now race-safe.
  - **Matchmaker dedupe** (MED): two concurrent `/register` or `/matchmake/run` calls could pair the same two users into two battles. Now each candidate is atomically claimed via conditional `update_one({user_id, in_queue:true})`; if the second claim fails, the first is rolled back into the queue.
  - **Double-vote** (MED): non-atomic check-then-write let a fast double-tap count twice. Now uses guarded `update_one({voters:{$ne:voter_id}}, {$inc, $push:voters})`; `modified_count == 0` returns 409.
- **Regression tests added**: `/app/backend/tests/test_battle_concurrency.py` — 3 tests that fire 10 concurrent votes/finish/register against the same resource and assert exact invariants. All 3 PASS.
- **BackstageCinema demo guard**: like/share buttons now detect `recording.id === "demo-cinematic"` and skip the API call (no more error toasts in the preview-cinematic flow).
- **Pitch Deck**: created `/app/PITCH_DECK.md` — Rap Battle Matchmaker-centric mission brief for the AI Builder Contest, covering matchmaking-within-the-hour, user-ID stats, the Agreement Call, the 60-second live-streamed beat, the 1-week voting gallery, and the Quarterly Global Contest (Top 200).

## Mar 1, 2026 — CONTEST LAUNCH POLISH (iteration_33 follow-up)
- **Strict brand palette enforcement**: removed every off-brand accent (cyan #00E0FF, magenta #FF4FB1, purple #B57BFF, yellow #FFEB3B) across:
  - `GamerStage.js` — Guitar Hero `LANE_COLORS` re-palette → Orange / Green / Light-Orange (#FFA64D) / Light-Green (#7FFF8E); LightTrails SVG gradient re-tints (trail2/3/4); "Notes" label color from cyan → electric green.
  - `BackstageCinema.js` — curtain crack & spotlight gradients yellow → green; like-button heart violation pink → green.
  - `SocialProfile.js` — `GAMER_PALETTES` trimmed of purple/cyan/pink, replaced with on-brand `ember` and `mint` tonal variants.
- **Backstage Cinema demoability fix**: added `[data-testid='backstage-demo-cinema']` "Preview Cinematic Intro" CTA in the empty state of the Kept tab. Contest reviewers can now experience the 9-phase cinematic sequence (Backstage POV → Handoff → Stage Walk → Crowd Reveal → Zoom Avatar → Playback) without needing seeded recordings. Uses a synthetic `demo-cinematic` recording fixture; the API view/like POSTs fail silently as expected.
- **iteration_33 mobile-StadiumStudio FAIL invalidated**: self-tested at 390x844, `[data-testid='stadium-studio']` count = 1, mounts correctly. Test agent had a flaky run.
- **Pricing flow**: deferred per user direction ("don't worry about prices what so ever"). PricingPage.js remains orphaned-but-present; can be wired into the router post-launch.
- Build/lint clean for all modified files. Pre-existing `<span> in <option>` hydration warning still present (not source-located in app code — likely a transient Sonner / Radix internal; non-blocking).

## Jun 10, 2026 — GAMER LEARN TAB SHIPPED (iteration_34: 100% pass)
- New "Learn" tab in the Gamer-lane bottom nav (GraduationCap icon, between Tracks and Backstage; Gamer lane only).
- `pages/LearnPage.js` — instrument picker (Guitar / Piano) → 3 lessons each:
  - Guitar: Open Strings, E Minor Pentatonic, First Power Riff.
  - Piano: C Major Scale, Happy Birthday, Ode to Joy.
- `PracticeSession` full-screen view: neon perspective note highway (`components/learn/NoteHighway.js`, reuses GamerStage visual language), big target note, progress dots, score + streak badges, completion overlay with Replay / More Lessons, best score persisted to localStorage (`pp_learn_best_{id}`, ★ shown on lesson card).
- Real-time mic pitch detection: `services/PitchDetector.js` — Web Audio AnalyserNode + autocorrelation (ACF), octave-tolerant matching (±50 cents, 3-frame hold). `TunerGauge` shows detected note, Hz, cents needle.
- No-instrument fallback: interactive visual aids (`GuitarAid` clickable fretboard with target dot + position hint; `PianoAid` clickable keyboard) — tapping the correct position counts as a hit; wrong tap resets streak + toast. "Hear Note" plays a reference triangle-wave tone.
- Router: `case "learn"` in ViewRouter.js. Fully client-side, no backend endpoints.
- Tested: iteration_34 — all 11 acceptance criteria pass (both full lesson sequences, wrong-note handling, mic grant/deny grace, exit, best-score star, creator-lane regression, 0 console errors).

### Remaining backlog (unchanged)
- P1: Decompose `BecomeAStar.js` (717 lines); "Show on Both" licensing constraints in Backstage.
- P2: SEO fixes (robots.txt, sitemap.xml, llms.txt); refactor `_run_band_activity_check()`, `get_lyrics()`, `separate_stems()`; YouTube/TikTok OAuth (BLOCKED on user credentials).

## Jul 26, 2026 — MAJOR PIVOT: APP IS NOW 100% FREE (iteration_35: 100% pass both)
- **All paywalls removed**: $79.98 AUD ownership gate, $9.99/mo finance plan, all 9 subscription tiers, Stripe checkout/webhook — GONE.
- Backend:
  - `payments.py` rewritten as free stubs: `/ownership/{user}/status` → always owned; `/ownership/products` → empty; `/payments/checkout` + `/payments/status` → free message (no Stripe).
  - `platform.py`: SUBSCRIPTION_TIERS deleted; `/subscriptions/tiers|select|{user}/status` → universal free-access stubs (is_pro/is_vip true); band activity check → no-op (scheduler-safe); band audit + band upload endpoints removed (404); `/rewards/credit-winner` → Champion badge only (no sub months).
  - `lanes.py`: `/catalog/in/{track}` → `requires_ownership: false` always.
  - **70/30 artist split RETAINED**: `/store/purchase` ($0.79/song → $0.55 artist / $0.24 platform), `/store/pricing`, `/store/library`, `/store/check` unchanged.
  - Deleted obsolete tests: test_iteration19_payments, test_iteration20_ownership, test_subscriptions. New suite: `backend/tests/test_free_pivot.py` (16/16 pass).
- Frontend:
  - `PricingPage.js` rewritten → "100% Free. Forever." page (route "pricing" kept): free badge hero, "Start Creating — Free" CTA, 8-feature Everything Unlocked grid, artist-economy card (70/30 bar).
  - `SocialProfile.js`: TIER_LABELS / subStatus / Pro card / go-pro-btn / band tracker removed → "Everything Unlocked — Free" card (free-access-card) linking to the free page.
  - `GamerPage.js`: pickTrack ownership gate removed; footer → "Every track, every mode — 100% free."
  - `LiveChat.js`: VIP/PRO badge logic fully removed.
- Deployment health check passed earlier (Jun 10); re-verify before deploy after pivot.

## Aug 5, 2026 — RAP BATTLES: 45 SECONDS PER RAPPER (self-tested e2e)
- Battle format changed from single 60s beat → **90s beat, 45s per rapper** (first mover raps 0:00–0:45, opponent 0:45–1:30).
- Backend (`battles.py`): BEAT_DURATION_SEC=90, TURN_DURATION_SEC=45; `_generate_battle_beat()` (renamed) renders 33 pattern reps ≈ 91s WAV; battle doc now stores `beat_duration_sec` + `turn_duration_sec` on agree.
- Frontend (`BattleLiveStage.js`): TURN_SEC/TOTAL_SEC constants; live "On the Mic · Xs left" turn banner that flips at 45s; active rapper card gets glow + "On Mic" badge (battle-active-a/b testids); progress bar /90 with midpoint turn marker; finish trigger at 90s. Also repaired a corrupted duplicate tail in RapperStage.
- Copy updates: BattleHub ("Auto-match · 45s each"), ConnectPage, SocialProfile ("My Raps"), PITCH_DECK.md.
- Verified via curl e2e: register×2 → matched → agree×2 → beat_dur 90/turn_dur 45 → go-live → served WAV decoded at 91.0s. UI copy verified via screenshot. Test battle data cleaned from DB.
