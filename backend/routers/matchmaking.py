from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/matchmaking", tags=["matchmaking"])

# In-memory matchmaking queue (use Redis in production)
# queue: username -> {"time_control": str, "joined_at": datetime}
queue: dict = {}
# pairs: username -> {"game_id": str, "opponent": str, "color": str, "time_control": str, "paired_at": datetime}
pairs: dict = {}

QUEUE_TTL = timedelta(minutes=5)

class JoinRequest(BaseModel):
    username: str
    time_control: str = "10+0"  # es. 1+0 bullet, 3+0 blitz, 5+0 rapid, 10+0 classic

class StatusResponse(BaseModel):
    username: str
    status: str  # queued | paired | not_found
    game_id: Optional[str] = None
    opponent: Optional[str] = None
    color: Optional[str] = None
    time_control: Optional[str] = None

def cleanup_expired():
    """Rimuove utenti in coda oltre il TTL"""
    now = datetime.now()
    for username, entry in list(queue.items()):
        if now - entry["joined_at"] > QUEUE_TTL:
            queue.pop(username, None)

@router.post("/queue", response_model=StatusResponse)
async def join_queue(req: JoinRequest):
    """
    Entra in coda matchmaking. Se esiste un avversario con lo stesso time control,
    accoppia i due e restituisce game_id + colore. Altrimenti resta in coda.
    """
    cleanup_expired()

    # Se già accoppiato, restituisci lo stato
    if req.username in pairs:
        p = pairs[req.username]
        return StatusResponse(
            username=req.username,
            status="paired",
            game_id=p["game_id"],
            opponent=p["opponent"],
            color=p["color"],
            time_control=p["time_control"],
        )

    # Se già in coda, resta in coda
    if req.username in queue:
        return StatusResponse(username=req.username, status="queued", time_control=req.time_control)

    # Cerca un avversario in coda con lo stesso time control
    for opponent, entry in list(queue.items()):
        if entry["time_control"] == req.time_control:
            queue.pop(opponent, None)
            game_id = str(uuid.uuid4())

            # Colore: chi arriva prima (opponent) gioca bianco, il nuovo gioca nero
            pairs[opponent] = {
                "game_id": game_id,
                "opponent": req.username,
                "color": "white",
                "time_control": req.time_control,
                "paired_at": datetime.now(),
            }
            pairs[req.username] = {
                "game_id": game_id,
                "opponent": opponent,
                "color": "black",
                "time_control": req.time_control,
                "paired_at": datetime.now(),
            }

            return StatusResponse(
                username=req.username,
                status="paired",
                game_id=game_id,
                opponent=opponent,
                color="black",
                time_control=req.time_control,
            )

    # Nessun avversario disponibile → entra in coda
    queue[req.username] = {"time_control": req.time_control, "joined_at": datetime.now()}
    return StatusResponse(username=req.username, status="queued", time_control=req.time_control)

@router.get("/status", response_model=StatusResponse)
async def get_status(username: str):
    """
    Controlla lo stato del matchmaking. Se accoppiato, restituisce game_id (consuma la coppia).
    """
    if username in pairs:
        p = pairs.pop(username, None)
        # Pulisci anche la coppia dell'avversario per evitare duplicati
        if p and p["opponent"] in pairs:
            pairs.pop(p["opponent"], None)
        return StatusResponse(
            username=username,
            status="paired",
            game_id=p["game_id"],
            opponent=p["opponent"],
            color=p["color"],
            time_control=p["time_control"],
        )

    if username in queue:
        return StatusResponse(username=username, status="queued", time_control=queue[username]["time_control"])

    return StatusResponse(username=username, status="not_found")

@router.delete("/leave")
async def leave_queue(username: str):
    """
    Esce dalla coda / annulla una coppia in attesa di pickup.
    """
    queue.pop(username, None)
    if username in pairs:
        p = pairs.pop(username, None)
        if p and p["opponent"] in pairs:
            pairs.pop(p["opponent"], None)
    return {"message": "Left matchmaking queue", "username": username}
