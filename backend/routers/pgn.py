from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import chess
import chess.pgn
from io import StringIO
import uuid
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/pgn", tags=["pgn"])

# In-memory storage for PGN sessions (use Redis in production)
pgn_sessions: Dict[str, dict] = {}

class PGNUploadResponse(BaseModel):
    session_id: str
    games: List[dict]
    total_games: int

class GameData(BaseModel):
    session_id: str
    game_index: int
    headers: dict
    moves: List[str]
    fen_positions: List[str]
    current_position: int

class MoveNavigationRequest(BaseModel):
    session_id: str
    game_index: int
    move_number: int

@router.post("/upload", response_model=PGNUploadResponse)
async def upload_pgn(file: UploadFile = File(...)):
    """
    Upload a PGN file and parse all games
    
    Returns a session ID and list of games with metadata
    """
    if not file.filename.endswith('.pgn'):
        raise HTTPException(status_code=400, detail="File must be a .pgn file")
    
    try:
        content = await file.read()
        pgn_text = content.decode('utf-8')
        
        # Parse all games in the PGN
        pgn_io = StringIO(pgn_text)
        games = []
        game_count = 0
        
        while True:
            game = chess.pgn.read_game(pgn_io)
            if game is None:
                break
            
            # Limit to first 100 games to avoid memory issues
            if game_count >= 100:
                break
            
            headers = dict(game.headers)
            
            # Extract moves
            moves = []
            board = game.board()
            for move in game.mainline_moves():
                san = board.san(move)
                moves.append(san)
                board.push(move)
            
            games.append({
                "index": game_count,
                "headers": headers,
                "white": headers.get("White", "Unknown"),
                "black": headers.get("Black", "Unknown"),
                "result": headers.get("Result", "*"),
                "date": headers.get("Date", "????.??.??"),
                "event": headers.get("Event", "Unknown"),
                "move_count": len(moves)
            })
            
            game_count += 1
        
        if game_count == 0:
            raise HTTPException(status_code=400, detail="No valid games found in PGN file")
        
        # Create session
        session_id = str(uuid.uuid4())
        pgn_sessions[session_id] = {
            "pgn_text": pgn_text,
            "games": games,
            "created_at": datetime.now(),
            "total_games": game_count
        }
        
        # Clean up old sessions (older than 1 hour)
        cleanup_old_sessions()
        
        return PGNUploadResponse(
            session_id=session_id,
            games=games,
            total_games=game_count
        )
        
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Invalid file encoding. PGN must be UTF-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error parsing PGN: {str(e)}")

@router.get("/game/{session_id}/{game_index}", response_model=GameData)
async def get_game(session_id: str, game_index: int):
    """
    Get full data for a specific game in a PGN session
    """
    if session_id not in pgn_sessions:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    session = pgn_sessions[session_id]
    
    if game_index >= session["total_games"]:
        raise HTTPException(status_code=404, detail="Game index out of range")
    
    # Re-parse the specific game
    pgn_io = StringIO(session["pgn_text"])
    
    for i in range(game_index + 1):
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            raise HTTPException(status_code=404, detail="Game not found")
    
    # Extract all moves and FEN positions
    headers = dict(game.headers)
    moves = []
    fen_positions = []
    
    board = game.board()
    fen_positions.append(board.fen())  # Starting position
    
    for move in game.mainline_moves():
        san = board.san(move)
        moves.append(san)
        board.push(move)
        fen_positions.append(board.fen())
    
    return GameData(
        session_id=session_id,
        game_index=game_index,
        headers=headers,
        moves=moves,
        fen_positions=fen_positions,
        current_position=0
    )

@router.post("/navigate")
async def navigate_moves(request: MoveNavigationRequest):
    """
    Navigate to a specific move in a game
    
    Returns the FEN position at that move
    """
    if request.session_id not in pgn_sessions:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    session = pgn_sessions[request.session_id]
    
    if request.game_index >= session["total_games"]:
        raise HTTPException(status_code=404, detail="Game index out of range")
    
    # Re-parse the specific game
    pgn_io = StringIO(session["pgn_text"])
    
    for i in range(request.game_index + 1):
        game = chess.pgn.read_game(pgn_io)
        if game is None:
            raise HTTPException(status_code=404, detail="Game not found")
    
    # Navigate to specific move
    board = game.board()
    moves = list(game.mainline_moves())
    
    if request.move_number < 0 or request.move_number > len(moves):
        raise HTTPException(status_code=400, detail="Invalid move number")
    
    # Play moves up to the requested position
    for i in range(request.move_number):
        board.push(moves[i])
    
    return {
        "fen": board.fen(),
        "move_number": request.move_number,
        "move_san": board.san(moves[request.move_number]) if request.move_number < len(moves) else None,
        "total_moves": len(moves)
    }

@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """
    Delete a PGN session
    """
    if session_id in pgn_sessions:
        del pgn_sessions[session_id]
        return {"message": "Session deleted successfully"}
    raise HTTPException(status_code=404, detail="Session not found")

def cleanup_old_sessions():
    """Remove sessions older than 1 hour"""
    now = datetime.now()
    expired = []
    
    for session_id, session in pgn_sessions.items():
        if now - session["created_at"] > timedelta(hours=1):
            expired.append(session_id)
    
    for session_id in expired:
        del pgn_sessions[session_id]

@router.get("/session/{session_id}")
async def get_session_info(session_id: str):
    """
    Get information about a PGN session
    """
    if session_id not in pgn_sessions:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    session = pgn_sessions[session_id]
    return {
        "session_id": session_id,
        "total_games": session["total_games"],
        "games": session["games"],
        "created_at": session["created_at"].isoformat()
    }
