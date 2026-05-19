"""Pocket Products API — Modular FastAPI backend.
Routes are organized into domain modules under /routes/.
"""
from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import shared state
from database import db, client

app = FastAPI(title="Pocket Products API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Import route modules ────────────────────────
from routes.core import router as core_router
from routes.songs import router as songs_router
from routes.lyrics import router as lyrics_router
from routes.music import router as music_router
from routes.community import router as community_router
from routes.platform import router as platform_router, chat_mgr, _run_band_activity_check
from routes.payments import router as payments_router
from routes.connect import router as connect_router
from routes.studio_ai import router as studio_ai_router
from routes.lanes import router as lanes_router

# ── Register all route modules on the /api prefix ─
api_router.include_router(core_router)
api_router.include_router(songs_router)
api_router.include_router(lyrics_router)
api_router.include_router(music_router)
api_router.include_router(community_router)
api_router.include_router(platform_router)
api_router.include_router(payments_router)
api_router.include_router(connect_router)
api_router.include_router(studio_ai_router)
api_router.include_router(lanes_router)

app.include_router(api_router)

# ── WebSocket (must be on app, not api_router) ──
from datetime import datetime, timezone

@app.websocket("/api/ws/chat/{room}")
async def ws_chat(ws: WebSocket, room: str):
    await chat_mgr.connect(room, ws)
    join_msg = {"type": "system", "text": "A fan joined the stage", "viewers": chat_mgr.viewer_count(room), "ts": datetime.now(timezone.utc).isoformat()}
    await chat_mgr.broadcast(room, join_msg)
    try:
        while True:
            data = await ws.receive_json()
            msg = {"type": "message", "user": data.get("user", "Fan"), "text": data.get("text", ""),
                "badge": data.get("badge", ""), "ts": datetime.now(timezone.utc).isoformat(), "viewers": chat_mgr.viewer_count(room)}
            await db.chat_messages.insert_one({"room": room, "user": msg["user"], "text": msg["text"], "badge": msg["badge"], "ts": msg["ts"]})
            await chat_mgr.broadcast(room, msg)
    except WebSocketDisconnect:
        chat_mgr.disconnect(room, ws)
        leave_msg = {"type": "system", "text": "A fan left the stage", "viewers": chat_mgr.viewer_count(room), "ts": datetime.now(timezone.utc).isoformat()}
        await chat_mgr.broadcast(room, leave_msg)
    except Exception:
        chat_mgr.disconnect(room, ws)


# ── Scheduled Cron: Band Activity Check ─────────
# Runs every Sunday at 00:00 UTC. Sleeps until the next Sunday,
# then executes the full band audit scan.

_cron_task = None


async def _band_cron_loop():
    """Background loop: sleep until next Sunday 00:00 UTC, then run the band check."""
    logger.info("[BandCron] Scheduler started — will fire every Sunday 00:00 UTC")
    while True:
        now = datetime.now(timezone.utc)
        # Calculate seconds until next Sunday 00:00 UTC
        days_until_sunday = (6 - now.weekday()) % 7
        if days_until_sunday == 0 and (now.hour > 0 or now.minute > 0 or now.second > 0):
            days_until_sunday = 7  # Already past Sunday midnight, wait for next week
        next_sunday = now.replace(hour=0, minute=0, second=0, microsecond=0)
        if days_until_sunday > 0:
            from datetime import timedelta
            next_sunday += timedelta(days=days_until_sunday)
        sleep_seconds = (next_sunday - now).total_seconds()
        if sleep_seconds < 1:
            sleep_seconds = 7 * 24 * 3600  # Fallback: 1 week

        logger.info(f"[BandCron] Next run at {next_sunday.isoformat()} ({sleep_seconds:.0f}s from now)")
        await asyncio.sleep(sleep_seconds)

        # Execute the band activity check
        try:
            result = await _run_band_activity_check(trigger="scheduled_cron_sunday")
            logger.info(
                f"[BandCron] Completed: checked={result['total_checked']} "
                f"compliant={result['compliant_count']} downgraded={result['downgraded_count']}"
            )
        except Exception as e:
            logger.error(f"[BandCron] Failed: {e}")
            # Log the failure to audit as well
            try:
                await db.band_audit_log.insert_one({
                    "type": "cron_error",
                    "error": str(e),
                    "checked_at": datetime.now(timezone.utc).isoformat(),
                    "trigger": "scheduled_cron_sunday",
                })
            except Exception:
                pass


@app.on_event("startup")
async def start_band_cron():
    global _cron_task
    _cron_task = asyncio.create_task(_band_cron_loop())
    logger.info("[BandCron] Background task registered")


# ── CORS ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown():
    if _cron_task:
        _cron_task.cancel()
    client.close()
