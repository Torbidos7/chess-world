from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from ..database import get_db, User, Game, Friendship, GameInvite

router = APIRouter(prefix="/api/users", tags=["users"])

class UserProfile(BaseModel):
    username: str
    elo: int
    games_played: int
    wins: int
    losses: int
    draws: int
    email: Optional[str] = None

class FriendRequest(BaseModel):
    friend_username: str

class InviteRequest(BaseModel):
    receiver: str
    time_control: str = "10+0"

@router.get("/{username}/profile", response_model=UserProfile)
async def get_user_profile(username: str, db: Session = Depends(get_db)):
    """
    Get user profile data
    """
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        # Return mock data for demo
        return UserProfile(
            username=username,
            elo=1200,
            games_played=0,
            wins=0,
            losses=0,
            draws=0
        )
    
    return UserProfile(
        username=user.username,
        elo=user.elo,
        games_played=user.games_played,
        wins=user.wins,
        losses=user.losses,
        draws=user.draws,
        email=user.email
    )

@router.get("/{username}/games")
async def get_user_games(username: str, limit: int = 20, db: Session = Depends(get_db)):
    """
    Get user's game history
    """
    games = db.query(Game).filter(
        (Game.white_username == username) | (Game.black_username == username)
    ).order_by(Game.date.desc()).limit(limit).all()

    return {
        "username": username,
        "games": [
            {
                "id": g.id,
                "white": g.white_username,
                "black": g.black_username,
                "result": g.result,
                "moves": g.moves or [],
                "time_control": g.time_control,
                "date": g.date.isoformat() if g.date else None,
                "winner": g.winner,
                "status": g.status,
            }
            for g in games
        ],
        "total": len(games),
    }

@router.post("/{username}/friends/add")
async def add_friend(username: str, request: FriendRequest, db: Session = Depends(get_db)):
    """
    Add a friend (send friend request)
    """
    friend_username = request.friend_username

    if username == friend_username:
        raise HTTPException(status_code=400, detail="You cannot add yourself as a friend")

    target = db.query(User).filter(User.username == friend_username).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    # Check existing friendship in either direction
    existing = db.query(Friendship).filter(
        ((Friendship.user_a == username) & (Friendship.user_b == friend_username)) |
        ((Friendship.user_a == friend_username) & (Friendship.user_b == username))
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(status_code=400, detail="Already friends")
        raise HTTPException(status_code=400, detail="Friend request already sent")

    friendship = Friendship(user_a=username, user_b=friend_username, status="pending")
    db.add(friendship)
    db.commit()

    return {
        "message": f"Friend request sent to {friend_username}",
        "status": "pending",
    }

@router.post("/{username}/friends/accept")
async def accept_friend(username: str, friend_username: str, db: Session = Depends(get_db)):
    """
    Accept a pending friend request
    """
    friendship = db.query(Friendship).filter(
        (Friendship.user_a == friend_username) & (Friendship.user_b == username) &
        (Friendship.status == "pending")
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="No pending request found")

    friendship.status = "accepted"
    db.commit()

    return {"message": f"Friend request from {friend_username} accepted", "status": "accepted"}

@router.delete("/{username}/friends/remove")
async def remove_friend(username: str, friend_username: str, db: Session = Depends(get_db)):
    """
    Remove a friend (or decline a request)
    """
    friendship = db.query(Friendship).filter(
        ((Friendship.user_a == username) & (Friendship.user_b == friend_username)) |
        ((Friendship.user_a == friend_username) & (Friendship.user_b == username))
    ).first()

    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")

    db.delete(friendship)
    db.commit()

    return {"message": f"Removed {friend_username} from friends"}

@router.get("/{username}/friends")
async def get_friends(username: str, db: Session = Depends(get_db)):
    """
    Get user's accepted friends list
    """
    friends = db.query(Friendship).filter(
        ((Friendship.user_a == username) | (Friendship.user_b == username)) &
        (Friendship.status == "accepted")
    ).all()

    result = []
    for f in friends:
        other = f.user_b if f.user_a == username else f.user_a
        result.append({"username": other, "since": f.created_at.isoformat() if f.created_at else None})

    return {"username": username, "friends": result, "total": len(result)}

@router.get("/{username}/friends/requests")
async def get_friend_requests(username: str, db: Session = Depends(get_db)):
    """
    Get incoming pending friend requests
    """
    requests = db.query(Friendship).filter(
        (Friendship.user_b == username) & (Friendship.status == "pending")
    ).all()

    return {
        "username": username,
        "requests": [
            {"from": r.user_a, "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in requests
        ],
        "total": len(requests),
    }

@router.post("/{username}/invite")
async def send_game_invitation(username: str, request: InviteRequest, db: Session = Depends(get_db)):
    """
    Send a real game invitation to a friend.
    """
    receiver = request.receiver

    if username == receiver:
        raise HTTPException(status_code=400, detail="You cannot invite yourself")

    target = db.query(User).filter(User.username == receiver).first()
    if not target:
        raise HTTPException(status_code=404, detail="Receiver not found")

    # Evita inviti duplicati pending
    existing = db.query(GameInvite).filter(
        (GameInvite.sender == username) & (GameInvite.receiver == receiver) &
        (GameInvite.status == "pending")
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Invite already pending")

    invite = GameInvite(sender=username, receiver=receiver, status="pending", time_control=request.time_control)
    db.add(invite)
    db.commit()

    return {
        "message": f"Game invitation sent to {receiver}",
        "invitation_id": invite.id,
        "status": "pending",
    }

@router.get("/{username}/invites/pending")
async def get_pending_invites(username: str, db: Session = Depends(get_db)):
    """
    Get incoming pending game invitations.
    """
    invites = db.query(GameInvite).filter(
        (GameInvite.receiver == username) & (GameInvite.status == "pending")
    ).order_by(GameInvite.created_at.desc()).all()

    return {
        "username": username,
        "invites": [
            {
                "id": i.id,
                "from": i.sender,
                "time_control": i.time_control,
                "created_at": i.created_at.isoformat() if i.created_at else None,
            }
            for i in invites
        ],
        "total": len(invites),
    }

@router.post("/{username}/invites/{invite_id}/accept")
async def accept_game_invitation(username: str, invite_id: int, db: Session = Depends(get_db)):
    """
    Accept a pending game invitation. Crea una partita condivisa e restituisce game_id.
    """
    invite = db.query(GameInvite).filter(
        (GameInvite.id == invite_id) & (GameInvite.receiver == username) &
        (GameInvite.status == "pending")
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="No pending invite found")

    invite.status = "accepted"
    invite.game_id = str(uuid.uuid4())
    db.commit()

    return {
        "message": f"Game started with {invite.sender}",
        "game_id": invite.game_id,
        "opponent": invite.sender,
        "time_control": invite.time_control,
        "color": "black",  # l'invitante è bianco (sender), l'accettante nero
    }

@router.post("/{username}/invites/{invite_id}/decline")
async def decline_game_invitation(username: str, invite_id: int, db: Session = Depends(get_db)):
    """
    Decline a pending game invitation.
    """
    invite = db.query(GameInvite).filter(
        (GameInvite.id == invite_id) & (GameInvite.receiver == username) &
        (GameInvite.status == "pending")
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="No pending invite found")

    invite.status = "declined"
    db.commit()
    return {"message": "Invite declined", "invitation_id": invite.id, "status": "declined"}

@router.post("/{username}/invites/{invite_id}/status")
async def invite_status(username: str, invite_id: int, db: Session = Depends(get_db)):
    """
    Poll dello stato di un invito inviato (per l'invitante): se accettato restituisce game_id.
    """
    invite = db.query(GameInvite).filter(
        (GameInvite.id == invite_id) & (GameInvite.sender == username)
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")

    if invite.status == "accepted" and invite.game_id:
        return {
            "status": "accepted",
            "game_id": invite.game_id,
            "opponent": invite.receiver,
            "time_control": invite.time_control,
            "color": "white",
        }

    return {"status": invite.status, "invitation_id": invite.id}
