# SIDETRACK — Launch-Ready PRD

## Architecture
```
/app/backend/
  server.py           # App setup, routes, WebSocket, Band Cron
  database.py          # MongoDB connection
  config.py            # API keys, constants
  models.py            # Pydantic models
  routes/
    core.py            # Health
    songs.py           # Recognition, stems, recordings
    lyrics.py          # LRCLIB, chord engine
    music.py           # iTunes streaming, skips
    community.py       # Battles, playlists, duets, stars, challenges
    platform.py        # Subscriptions, band downgrade, trim, chat, social, rewards, discovery, sync
    payments.py        # Stripe checkout, status polling, webhook
```

## All Features (Complete)
- Shazam recognition + Replicate Demucs AI stems
- iTunes streaming + 50 skip/day limit
- LRCLIB synced lyrics + music-theory chord engine + SVG diagrams
- Interactive Fan Mixer: Mute/Solo/Artist Presets
- Cover Battles + Duets + Become a Star + Weekly Challenges
- Playlists + Live Stage + Stadium WebSocket Chat
- Social profiles: follows, likes, live stats
- 7 subscription tiers + Stadium VIP
- **Stripe Checkout** (real payments via emergentintegrations)
- Band Auto-Downgrade Cron (Sunday 00:00 UTC) + audit trail
- Competition winner auto-credit
- Real audio trimming (pydub/ffmpeg)
- Vibe-Match personalized discovery
- SIDETRACK Orange/Green/Dark branding (100%)

## Stripe Payment Flow
1. User clicks tier → `POST /api/payments/checkout` (amount from server-side TIER_PRICES)
2. Backend creates `payment_transactions` record (status=pending)
3. User redirected to `checkout.stripe.com`
4. After payment → redirected back with `?session_id=`
5. App.js detects URL params → routes to PricingPage
6. PricingPage polls `GET /api/payments/status/{session_id}` (8 attempts, 2s intervals)
7. On paid → subscription activated, banner shown
8. Webhook at `POST /api/webhook/stripe` as backup confirmation

## Nothing Remaining
All P0 items complete. App is launch-ready.
