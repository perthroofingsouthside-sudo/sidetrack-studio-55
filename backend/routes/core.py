"""Core routes: health, root."""
from fastapi import APIRouter
from config import RAPIDAPI_KEY

router = APIRouter()


@router.get("/")
async def root() -> dict[str, str]:
    return {"message": "Pocket Products API"}


@router.get("/health")
async def health() -> dict[str, str | bool]:
    return {"status": "healthy", "shazam_configured": bool(RAPIDAPI_KEY)}
