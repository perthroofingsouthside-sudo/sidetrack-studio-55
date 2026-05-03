# SIDETRACK - Music Recognition, Streaming & Creation App

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK. Features: song recognition, music streaming with daily skip limits, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles, Pro Tier Pricing with Stadium VIP fan pass.

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
- [x] **Daily Skip Limiter**: 50 skips/day per user, resets midnight UTC
- [x] Neon Orange / Neon Green color scheme (all files)
- [x] LRCLIB API integration for real synced lyrics
- [x] Social Profile page with Pro Status indicator + Go Pro button
- [x] Polished Stream dashboard (hero, neon progress, crystal-glass)
- [x] Live Stage Recording Studio (glassmorphism, ambient, LiveChat sidebar)
- [x] LiveChat component (Live + Comments modes)
- [x] iTunes streaming, search, Top Albums/Songs
- [x] Shazam song recognition + Replicate Demucs stems
- [x] Stem Mixer, Cover Battles, Duet Mode
- [x] Become a Star karaoke + Star Challenges (Wed-Wed)
- [x] Playlists (public/private CRUD) + 8-tab navigation
- [x] **Stadium VIP Fan Pass ($4.98/mo)** — Save/share mixes, neon chat badges, priority artist DMs
- [x] **Full Pricing Page** — 7 tiers (Stadium VIP, Individual, Student, Couple/Duo, Family, Adult Band, Under-18 Band)
- [x] **Subscription Backend** — Tier listing, selection with 30-day free trial, status check
- [x] **Competition Reward Banner** — Win a Battle = 1 Month Free Pro
- [x] **Synced Lyrics in Player** — Real LRCLIB lyrics with neon green glow, auto-scroll, "SYNCED" badge. Fallback to /api/lyrics/fetch for iTunes stream tracks
- [x] **Chords Toggle** — Guitar chords strip in PlayerStudio, toggleable on/off, shows current chord + upcoming progression
- [x] **Pro Status Indicator** — Dynamic tier badge on SocialProfile (shows tier name, trial/pro status, tier-colored glow)
- [x] **Band Weekly Upload Tracker** — Progress bar showing upload count toward 1/week requirement, week reset countdown
- [x] **Trim & Share Modal** — In RecordingStudio, opens with waveform viz + start/end sliders, calls POST /api/trim
- [x] **Direct Lyrics Fetch** — GET /api/lyrics/fetch?track=X&artist=Y for full parsed lyrics without DB lookup

## Subscription Tiers
| Tier | Price | Category |
|------|-------|----------|
| Stadium VIP | $4.98/mo | Fan |
| Individual | $11.98/mo | Creator |
| Student | $9.98/mo | Creator |
| Couple/Duo | $14.98/mo | Creator |
| Family (5 ppl) | $20.98/mo | Creator |
| Adult Band | $17.98/mo | Band |
| Under-18 Band | $2.98/mo | Band |

## DB Collections
songs, recordings, battles, covers, playlists, duets, stars, challenges, skip_counters, subscriptions, band_uploads

## What's Still MOCKED
- Guitar chords data (mock chord progressions — API coming soon)
- LiveChat messages (client-side mock)
- Payment processing (tier selection works but no Stripe checkout yet)
- Trim API (returns confirmation, no real audio slicing)

## Prioritized Backlog
### P0
- [ ] Integrate Stripe payments for real checkout (test key available in env)

### P1
- [ ] Competition winner auto-credit 1 month Pro
- [ ] Active Band auto-downgrade on missed upload week (cron/on-login)

### P2
- [ ] Full A/V editing/trimming with real audio processing
- [ ] Social Profile: live stats from DB
- [ ] WebSocket backend for LiveChat
- [ ] Real chord API integration (replace mock chords)
- [ ] Refactor server.py (~1500 lines) into modular route files
