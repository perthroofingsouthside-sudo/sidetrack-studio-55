"""Direct Messaging, Video/Audio Calling, and Jam Invites."""
from fastapi import APIRouter, HTTPException, Form
from pydantic import BaseModel
from database import db
from datetime import datetime, timezone
import uuid

router = APIRouter()


class SendMessage(BaseModel):
    from_user: str
    to_user: str
    text: str = ""
    media_url: str = ""
    media_type: str = ""  # "image", "audio", "video"


class JamInvite(BaseModel):
    from_user: str
    to_user: str
    song_id: str = ""
    song_title: str = ""
    message: str = ""


@router.post("/messages/send")
async def send_message(msg: SendMessage):
    """Send a direct message."""
    if not msg.text and not msg.media_url:
        raise HTTPException(status_code=400, detail="Message must have text or media")
    if msg.from_user == msg.to_user:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Create conversation ID (sorted user pair for consistency)
    pair = sorted([msg.from_user, msg.to_user])
    convo_id = f"{pair[0]}___{pair[1]}"

    doc = {
        "id": str(uuid.uuid4()),
        "convo_id": convo_id,
        "from_user": msg.from_user,
        "to_user": msg.to_user,
        "text": msg.text,
        "media_url": msg.media_url,
        "media_type": msg.media_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(doc)

    # Update conversation metadata
    await db.conversations.update_one(
        {"convo_id": convo_id},
        {"$set": {
            "convo_id": convo_id,
            "participants": pair,
            "last_message": msg.text or f"[{msg.media_type}]",
            "last_sender": msg.from_user,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"success": True, "message_id": doc["id"], "convo_id": convo_id}


@router.get("/messages/conversations/{user_id}")
async def list_conversations(user_id: str):
    """List all conversations for a user."""
    convos = await db.conversations.find(
        {"participants": user_id}, {"_id": 0}
    ).sort("updated_at", -1).to_list(50)

    # Add unread counts
    for c in convos:
        unread = await db.messages.count_documents({
            "convo_id": c["convo_id"], "to_user": user_id, "read": False
        })
        c["unread"] = unread
        # Determine the other user
        c["other_user"] = next((p for p in c["participants"] if p != user_id), "")

    return {"success": True, "conversations": convos}


@router.get("/messages/{convo_id}")
async def get_messages(convo_id: str, limit: int = 50):
    """Get messages in a conversation."""
    msgs = await db.messages.find(
        {"convo_id": convo_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    msgs.reverse()
    return {"success": True, "messages": msgs}


@router.post("/messages/{convo_id}/read")
async def mark_read(convo_id: str, user_id: str = Form(...)):
    """Mark all messages in a conversation as read for a user."""
    await db.messages.update_many(
        {"convo_id": convo_id, "to_user": user_id, "read": False},
        {"$set": {"read": True}},
    )
    return {"success": True}


# --- Jam Invites ---

@router.post("/jam/invite")
async def send_jam_invite(invite: JamInvite):
    """Send a Jam invite to another user."""
    doc = {
        "id": str(uuid.uuid4()),
        "from_user": invite.from_user,
        "to_user": invite.to_user,
        "song_id": invite.song_id,
        "song_title": invite.song_title,
        "message": invite.message,
        "status": "pending",  # pending, accepted, declined
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.jam_invites.insert_one(doc)
    return {"success": True, "invite_id": doc["id"]}


@router.get("/jam/invites/{user_id}")
async def get_jam_invites(user_id: str):
    """Get pending jam invites for a user."""
    received = await db.jam_invites.find(
        {"to_user": user_id, "status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    sent = await db.jam_invites.find(
        {"from_user": user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"success": True, "received": received, "sent": sent}


@router.post("/jam/invites/{invite_id}/respond")
async def respond_jam_invite(invite_id: str, action: str = Form(...)):
    """Accept or decline a jam invite."""
    if action not in ("accepted", "declined"):
        raise HTTPException(status_code=400, detail="Action must be 'accepted' or 'declined'")
    result = await db.jam_invites.update_one(
        {"id": invite_id, "status": "pending"},
        {"$set": {"status": action, "responded_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Invite not found or already responded")
    invite = await db.jam_invites.find_one({"id": invite_id}, {"_id": 0})
    return {"success": True, "invite": invite}


# --- Online Users (for calling) ---

@router.get("/connect/online")
async def get_online_users(limit: int = 30):
    """Get recently active users for connection."""
    # Use conversations + recent activity to suggest users
    recent = await db.conversations.find(
        {}, {"_id": 0, "participants": 1, "updated_at": 1}
    ).sort("updated_at", -1).to_list(limit)
    users = set()
    for c in recent:
        for p in c.get("participants", []):
            users.add(p)
    return {"success": True, "users": list(users)[:limit]}
