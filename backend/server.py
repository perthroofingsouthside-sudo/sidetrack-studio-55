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
from routes.sync import router as sync_router
from routes.jam import router as jam_router
from routes.gamer_catalog import router as gamer_catalog_router

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
api_router.include_router(sync_router)
api_router.include_router(jam_router)
api_router.include_router(gamer_catalog_router)

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


# ── WebRTC Signaling for Jam Rooms ──
# Lightweight in-memory peer registry per room. Each peer has a stable peer_id
# that they choose (we use the local userId stored in localStorage so peer
# identity is consistent across reconnects). Messages are routed by `target`.
_jam_peers: dict = {}  # {room_code: {peer_id: WebSocket}}


@app.websocket("/api/ws/jam/{code}")
async def ws_jam_signal(ws: WebSocket, code: str):
    """WebRTC signaling — relay offer/answer/ice between peers in a jam room.

    Message protocol (JSON):
      → from client on connect:   {"type":"hello", "peer_id":"abc", "name":"Joe"}
      → relayed offer/answer/ice: {"type":"offer|answer|ice", "target":"peerB", "from":"peerA", "data":{...}}
      ← peer-joined notification: {"type":"peer-joined", "peer_id":"abc", "name":"Joe", "peers":["abc","def"]}
      ← peer-left notification:   {"type":"peer-left", "peer_id":"abc"}
    """
    await ws.accept()
    code = (code or "").upper().strip()
    room = _jam_peers.setdefault(code, {})
    my_peer_id = None
    my_name = "Peer"
    try:
        while True:
            msg = await ws.receive_json()
            mtype = msg.get("type")

            if mtype == "hello":
                my_peer_id = (msg.get("peer_id") or "").strip()
                my_name = msg.get("name") or "Peer"
                if not my_peer_id:
                    await ws.send_json({"type": "error", "reason": "missing peer_id"})
                    continue
                # Disconnect any prior socket for this peer in this room
                prior = room.get(my_peer_id)
                if prior is not None and prior is not ws:
                    try:
                        await prior.close()
                    except Exception:
                        pass
                room[my_peer_id] = ws
                # Tell new peer the existing roster (excluding self)
                existing = [pid for pid in room.keys() if pid != my_peer_id]
                await ws.send_json({"type": "roster", "peers": existing, "you": my_peer_id})
                # Notify existing peers of the new arrival
                for pid, sock in list(room.items()):
                    if pid == my_peer_id:
                        continue
                    try:
                        await sock.send_json({"type": "peer-joined", "peer_id": my_peer_id, "name": my_name})
                    except Exception:
                        pass

            elif mtype in ("offer", "answer", "ice"):
                target = msg.get("target")
                if not target or target not in room:
                    continue
                sock = room.get(target)
                if sock is None:
                    continue
                try:
                    await sock.send_json({
                        "type": mtype,
                        "from": my_peer_id,
                        "data": msg.get("data"),
                    })
                except Exception:
                    pass

            elif mtype == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Cleanup + notify peers
        if my_peer_id and code in _jam_peers and _jam_peers[code].get(my_peer_id) is ws:
            del _jam_peers[code][my_peer_id]
            for pid, sock in list(_jam_peers[code].items()):
                try:
                    await sock.send_json({"type": "peer-left", "peer_id": my_peer_id})
                except Exception:
                    pass
            if not _jam_peers[code]:
                del _jam_peers[code]


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


@app.on_event("startup")
async def ensure_ttl_indexes():
    """Create TTL indexes on ephemeral Studio AI collections so old docs auto-purge after 30 days."""
    from database import db
    THIRTY_DAYS = 60 * 60 * 24 * 30
    for coll in ("beats", "cleanup_jobs"):
        try:
            await db[coll].create_index("created_at", expireAfterSeconds=THIRTY_DAYS, name="ttl_created_at_30d")
            logger.info(f"[TTL] {coll}.created_at TTL=30d ensured")
        except Exception as e:  # pragma: no cover
            logger.warning(f"[TTL] could not create TTL on {coll}: {e}")


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
