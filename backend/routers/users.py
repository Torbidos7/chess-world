from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db, User, Game, Friendship

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
async def send_game_invitation(username: str, friend_username: str, db: Session = Depends(get_db)):
    """
    Send a game invitation to a friend
    """
    return {
        "message": f"Game invitation sent to {friend_username}",
        "invitation_id": "pending",
    }
