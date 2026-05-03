# SIDETRACK — Final Product PRD

## Original Problem Statement
Build a music app like Shazam + Tidal called SIDETRACK. Features: song recognition, music streaming with daily skip limits, stem separation, stem mixer, split screen guitar chords + lyrics, audio/video recording with editing, social media sharing, Cover Battles, Playlists, flexible recording layouts, social live feed options, Duet Mode, Become a Star (karaoke), Star Challenges, Live Stage, Live Chat, Social Profiles, Pro Tier Pricing with Stadium VIP fan pass.

## Architecture
- **Frontend**: React + Tailwind CSS + Shadcn/UI
- **Backend**: FastAPI + MongoDB (Motor async) + WebSocket Chat
- **Music API**: iTunes Search API (no keys needed)
- **Stem Separation**: Replicate Demucs (real AI)
- **Song Recognition**: Shazam via RapidAPI
- **Lyrics**: LRCLIB API (real synced lyrics, no key needed)

## Color Scheme
- Primary: Neon Orange (#FF6B00)
- Secondary: Neon Green (#39FF14)
- Dark bg: #05050A, Surface: #0F0F16 / #12121A

## Final Product — All 8 Systems Integrated

### 1. AI Studio & Vocal Drop
- Replicate Demucs stem separation (vocals, guitar, bass, drums)
- Upload audio → background processing → poll for results
- Real audio URLs for each stem channel

### 2. Global Real-Time Sync
- `GET /api/sync/clock` — server UTC timestamp + epoch_ms
- `POST /api/sync/room` — create a jam sync room with master clock/BPM

### 3. Stadium WebSocket Chat
- `WebSocket /api/ws/chat/{room}` — real-time bidirectional chat
- `GET /api/chat/{room}/history` — persisted message history
- VIP/PRO badges, viewer count, auto-reconnect
- Messages persisted to MongoDB `chat_messages` collection

### 4. Lyrics & SVG Guitar Chords
- LRCLIB synced lyrics with neon green glow on active line, auto-scroll
- Fallback chain: `/api/songs/{id}/lyrics` → `/api/lyrics/fetch?track=X&artist=Y`
- SVG chord diagrams with nut line, string lines, glowing finger dots
- Chords toggle on/off in PlayerStudio

### 5. Interactive Fan Mixer (Mini-Mixer)
- Mute/Solo per stem (VOX, GTR, BAS, DRM)
- Artist Mix Presets: Vocal Focus, Band Only, Full Mix, Drums & Bass
- Solo button highlights with stem color glow

### 6. Social & Rewards
- `POST /api/social/follow` — follow/unfollow toggle
- `GET /api/social/{user_id}/stats` — live profile stats (battles, stars, playlists, followers, following, total_votes)
- `POST /api/social/{perf_id}/like` — like/unlike performances
- `POST /api/rewards/credit-winner` — auto-credit 1 month Pro to battle winner
- Profile shows follower/following counts, live stats from DB

### 7. Vibe-Match Discovery
- `GET /api/discover/for-you` — personalized recommendations based on playlist/battle history
- "For You" carousel on Stream page with "Because you like X" reasons
- Falls back to trending/pop hits for new users

### 8. SIDETRACK Branding
- Neon Orange (#FF6B00) + Electric Green (#39FF14) on Dark (#05050A) throughout
- No purple, violet, or blue anywhere
- "SIDETRACK" logo on Stream, Live Stage, Home pages
- BottomNav focus ring fixed to brand orange

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
songs, recordings, battles, covers, playlists, duets, stars, challenges, skip_counters, subscriptions, band_uploads, chat_messages, follows, likes, rewards, sync_rooms

## What's Still Mocked
- Guitar chord shapes (local dictionary, not a live chord API)
- Trim API returns confirmation without real audio slicing
- Payments (no Stripe checkout yet — tier selection is immediate)

## Remaining Backlog
### P0
- [ ] Stripe payments integration

### P1
- [ ] Real chord API integration
- [ ] Active Band auto-downgrade on missed upload
- [ ] Real audio trimming in Trim API

### P2
- [ ] Refactor server.py (~1900 lines) into modular routers
- [ ] Social Profile activity feed from real DB events
