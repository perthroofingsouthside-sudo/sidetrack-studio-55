"""Gamer Catalog routes — Triple J Hottest 100 + Top 200 Hip-Hop.

The catalog is the canonical music library for Gamer-Mode performances.
It loads /app/catalog/master_catalog.json on first request (cached in-process)
and lazily attaches iTunes Search cover URLs the first time a track is fetched.
"""
from __future__ import annotations
import json
import logging
from pathlib import Path
from typing import Any
from fastapi import APIRouter, Query, HTTPException
import httpx

from database import db

logger = logging.getLogger(__name__)
router = APIRouter()

CATALOG_PATH = Path("/app/catalog/master_catalog.json")

_cache: dict[str, Any] = {"tracks": None, "collections": None}


def _load_catalog() -> tuple[list[dict], list[dict]]:
    """Return cached (tracks, collections) tuple."""
    if _cache["tracks"] is not None:
        return _cache["tracks"], _cache["collections"]
    if not CATALOG_PATH.exists():
        logger.warning(f"[catalog] {CATALOG_PATH} missing — Gamer Tracks tab will be empty.")
        _cache["tracks"], _cache["collections"] = [], []
        return [], []
    data = json.loads(CATALOG_PATH.read_text())
    _cache["tracks"] = data.get("tracks", [])
    _cache["collections"] = data.get("collections", [])
    logger.info(f"[catalog] loaded {len(_cache['tracks'])} tracks · {len(_cache['collections'])} collections")
    return _cache["tracks"], _cache["collections"]


async def _enrich_cover(track: dict) -> dict:
    """Look up an iTunes preview/cover for tracks missing one. Caches in MongoDB."""
    if track.get("cover_url"):
        return track
    cached = await db.gamer_catalog_enrich.find_one({"track_id": track["track_id"]})
    if cached:
        return {**track, **{k: cached.get(k) for k in ("cover_url", "preview_url", "album", "duration_ms") if cached.get(k)}}
    # Lazy iTunes lookup
    try:
        q = f"{track['artist']} {track['title']}"
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get("https://itunes.apple.com/search", params={"term": q, "limit": 1, "media": "music"})
        if r.status_code == 200 and r.json().get("results"):
            it = r.json()["results"][0]
            enriched = {
                "track_id": track["track_id"],
                "cover_url": (it.get("artworkUrl100") or "").replace("100x100", "400x400"),
                "preview_url": it.get("previewUrl") or "",
                "album": it.get("collectionName") or "",
                "duration_ms": it.get("trackTimeMillis") or 0,
            }
            await db.gamer_catalog_enrich.update_one({"track_id": track["track_id"]}, {"$set": enriched}, upsert=True)
            return {**track, **enriched}
    except Exception as exc:
        logger.debug(f"[catalog] iTunes enrich failed for {track.get('title')}: {exc}")
    return track


@router.get("/gamer/catalog/collections")
async def get_collections() -> dict:
    """List available collections + year choices for the Tracks tab pickers."""
    _, collections = _load_catalog()
    return {"success": True, "collections": collections}


@router.get("/gamer/catalog/tracks")
async def get_tracks(
    collection: str | None = Query(None, description="hottest_100 | hip_hop_top_200"),
    year: int | None = Query(None, ge=1989, le=2030),
    q: str | None = Query(None, description="Search title / artist"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    enrich: bool = Query(True, description="Attach iTunes covers + previews lazily"),
) -> dict:
    """Filter the catalog and return paginated tracks for the Tracks tab."""
    tracks, _ = _load_catalog()
    out = tracks

    if collection == "hottest_100":
        out = [t for t in out if t.get("source") == "triple_j_hottest_100"]
        if year is not None:
            out = [t for t in out if t.get("year") == year]
    elif collection == "hip_hop_top_200":
        out = [t for t in out if t.get("source") == "top_200_hip_hop"]

    if q:
        needle = q.lower()
        out = [t for t in out if needle in t.get("title", "").lower() or needle in t.get("artist", "").lower()]

    total = len(out)
    out = out[offset : offset + limit]

    if enrich:
        out = [await _enrich_cover(t) for t in out]

    return {"success": True, "total": total, "tracks": out, "offset": offset, "limit": limit}


@router.get("/gamer/catalog/years")
async def get_years() -> dict:
    """Distinct list of years available in the Hottest 100 archive (for the year picker)."""
    tracks, _ = _load_catalog()
    years = sorted({t["year"] for t in tracks if t.get("source") == "triple_j_hottest_100" and t.get("year")}, reverse=True)
    return {"success": True, "years": years}
