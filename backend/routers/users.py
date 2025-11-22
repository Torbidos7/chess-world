from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from ..database import get_db, User

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
async def get_user_games(username: str, limit: int = 10, db: Session = Depends(get_db)):
    """
    Get user's game history
    
    TODO: Implement Game model and query
    """
    # Placeholder - implement when Game model is added
    return {
        "username": username,
        "games": [],
        "message": "Game history not yet implemented"
    }

@router.post("/{username}/friends/add")
async def add_friend(username: str, request: FriendRequest, db: Session = Depends(get_db)):
    """
    Add a friend
    
    TODO: Implement Friendship model
    """
    return {
        "message": f"Friend request to {request.friend_username} sent (not yet implemented)",
        "status": "pending"
    }

@router.delete("/{username}/friends/remove")
async def remove_friend(username: str, friend_username: str, db: Session = Depends(get_db)):
    """
    Remove a friend
    """
    return {
        "message": f"Removed {friend_username} from friends (not yet implemented)"
    }

@router.get("/{username}/friends")
async def get_friends(username: str, db: Session = Depends(get_db)):
    """
    Get user's friends list
    """
    return {
        "username": username,
        "friends": [],
        "message": "Friends feature not yet implemented"
    }

@router.post("/{username}/invite")
async def send_game_invitation(username: str, friend_username: str, db: Session = Depends(get_db)):
    """
    Send a game invitation to a friend
    """
    return {
        "message": f"Game invitation sent to {friend_username} (not yet implemented)",
        "invitation_id": "pending"
    }
