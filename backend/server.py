"""SIDETRACK API — Modular FastAPI backend.
Routes are organized into domain modules under /routes/.
"""
from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import logging

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Import shared state
from database import db, client

app = FastAPI(title="SIDETRACK API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ── Import route modules ────────────────────────
from routes.core import router as core_router
from routes.songs import router as songs_router
from routes.lyrics import router as lyrics_router
from routes.music import router as music_router
from routes.community import router as community_router
from routes.platform import router as platform_router, chat_mgr

# ── Register all route modules on the /api prefix ─
api_router.include_router(core_router)
api_router.include_router(songs_router)
api_router.include_router(lyrics_router)
api_router.include_router(music_router)
api_router.include_router(community_router)
api_router.include_router(platform_router)

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

# ── CORS ────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
