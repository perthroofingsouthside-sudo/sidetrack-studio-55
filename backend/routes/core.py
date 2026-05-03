"""Core routes: health, root."""
from fastapi import APIRouter
from config import RAPIDAPI_KEY

router = APIRouter()


@router.get("/")
async def root():
    return {"message": "SIDETRACK API"}


@router.get("/health")
async def health():
    return {"status": "healthy", "shazam_configured": bool(RAPIDAPI_KEY)}
