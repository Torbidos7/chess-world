```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
import chess
import chess.pgn
from io import StringIO
import os
import random
from ..services.puzzle_db import puzzle_db

router = APIRouter(prefix="/api/puzzles", tags=["puzzles"])

LICHESS_API_URL = os.getenv("LICHESS_API_URL", "https://lichess.org/api")

class Puzzle(BaseModel):
    id: str
    fen: str
    rating: int
    themes: List[str]
    solution: List[str]  # UCI moves
    initial_move: str  # First move (opponent's)

class PuzzleResponse(BaseModel):
    puzzle: Puzzle
    message: str

class ValidateMoveRequest(BaseModel):
    puzzle_id: str
    move_uci: str
    solution_index: int

@router.get("/daily", response_model=PuzzleResponse)
async def get_daily_puzzle():
    """
    Fetch the daily puzzle from Lichess
    """
    try:
        response = requests.get(
            f"{LICHESS_API_URL}/puzzle/daily",
            timeout=10
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Lichess API error: {response.text}"
            )
        
        data = response.json()
        
        # Parse Lichess puzzle format
        puzzle_data = data.get("puzzle", {})
        game_data = data.get("game", {})
        
        # Lichess doesn't provide FEN directly - we need to calculate it from PGN
        pgn_text = game_data.get("pgn", "")
        initial_ply = puzzle_data.get("initialPly", 0)
        
        # Parse PGN to get FEN at initialPly
        import io
        pgn_io = io.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn_io)
        
        if not game:
            raise HTTPException(status_code=500, detail="Could not parse puzzle PGN")
        
        # Play moves up to initialPly to get the puzzle position
        board = game.board()
        moves = list(game.mainline_moves())
        
        for i in range(min(initial_ply, len(moves))):
            board.push(moves[i])
        
        puzzle_fen = board.fen()
        
        puzzle = Puzzle(
            id=puzzle_data.get("id", "daily"),
            fen=puzzle_fen,
            rating=puzzle_data.get("rating", 1500),
            themes=puzzle_data.get("themes", []),
            solution=puzzle_data.get("solution", []),
            initial_move=""  # Lichess puzzles don't have initialMove - the position is set
        )
        
        return PuzzleResponse(
            puzzle=puzzle,
            message="Daily puzzle fetched successfully"
        )
        
    except requests.exceptions.RequestException as e:
        print(f"Lichess API connection error: {e}")
        raise HTTPException(status_code=503, detail=f"Lichess API unavailable: {str(e)}")
    except Exception as e:
        print(f"Unexpected error in get_daily_puzzle: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/validate")
async def validate_move(request: ValidateMoveRequest):
    """
    Validate a player's move against the puzzle solution
    
    - **puzzle_id**: ID of the puzzle
    - **move_uci**: Player's move in UCI format
    - **solution_index**: Index in the solution array
    """
    # In a real implementation, we'd store the puzzle solution in a cache/database
    # For now, we'll just return a simple validation response
    
    return {
        "correct": True,  # This should compare against actual solution
        "message": "Move validation endpoint - implement solution caching",
        "next_index": request.solution_index + 1
    }

# Track recently shown puzzles to avoid repetition
recent_puzzles = []
MAX_RECENT = 20

@router.get("/random")
async def get_random_puzzle(
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    theme: Optional[str] = None
):
    """
    Get a random puzzle from Lichess
    
    Since Lichess doesn't have a free random endpoint, we cycle through a list of known puzzle IDs
    """
    global recent_puzzles
    
    try:
        # Curated list of puzzle IDs for variety
        PUZZLE_IDS = [
            "tDqkO",  # Today's daily (changes daily)
            "03WZC", "08gBV", "0D5LG", "0Fpy6", "0IWxg",
            "1dzWZ", "2jqZ7", "3eQKK", "4mxHj", "5dG8U",
            "6H2wY", "7nLkP", "8QxRm", "9TvBn", "0AcDe"
        ]
        
        # Filter out recently shown puzzles
        available = [pid for pid in PUZZLE_IDS if pid not in recent_puzzles]
        if not available:
            # Reset if all have been shown
            recent_puzzles = []
            available = PUZZLE_IDS
        
        # Pick a random puzzle ID
        puzzle_id = random.choice(available)
        recent_puzzles.append(puzzle_id)
        if len(recent_puzzles) > MAX_RECENT:
            recent_puzzles.pop(0)
        
        # Try to fetch the specific puzzle
        response = requests.get(
            f"{LICHESS_API_URL}/puzzle/{puzzle_id}",
            timeout=10
        )
        
        # If specific puzzle fails, fall back to daily
        if response.status_code != 200:
            response = requests.get(
                f"{LICHESS_API_URL}/puzzle/daily",
                timeout=10
            )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Lichess API error: {response.text}"
            )
        
        data = response.json()
        puzzle_data = data.get("puzzle", {})
        game_data = data.get("game", {})
        
        # Parse PGN to get FEN (same logic as daily)
        pgn_text = game_data.get("pgn", "")
        initial_ply = puzzle_data.get("initialPly", 0)
        
        import io
        pgn_io = io.StringIO(pgn_text)
        game = chess.pgn.read_game(pgn_io)
        
        if not game:
            raise HTTPException(status_code=500, detail="Could not parse puzzle PGN")
        
        board = game.board()
        moves = list(game.mainline_moves())
        
        for i in range(min(initial_ply, len(moves))):
            board.push(moves[i])
        
        puzzle_fen = board.fen()
        
        puzzle = Puzzle(
            id=puzzle_data.get("id", "random"),
            fen=puzzle_fen,
            rating=puzzle_data.get("rating", 1500),
            themes=puzzle_data.get("themes", []),
            solution=puzzle_data.get("solution", []),
            initial_move=""  # Calculated position, no initial move needed
        )
        
        return PuzzleResponse(
            puzzle=puzzle,
            message="Random puzzle fetched successfully"
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Lichess API unavailable: {str(e)}")

@router.get("/local")
async def get_local_puzzle(
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None
):
    """
    Get a random puzzle from local database
    """
    try:
        puzzle_data = puzzle_db.get_random_puzzle(rating_min, rating_max)
        
        if not puzzle_data:
            raise HTTPException(status_code=404, detail="No puzzles found in local database")
        
        puzzle = Puzzle(
            id=puzzle_data['id'],
            fen=puzzle_data['fen'],
            rating=puzzle_data['rating'],
            themes=puzzle_data['themes'],
            solution=puzzle_data['solution'],
            initial_move=puzzle_data['initial_move']
        )
        
        return PuzzleResponse(
            puzzle=puzzle,
            message=f"Local puzzle fetched (Rating: {puzzle.rating})"
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading local puzzle: {str(e)}")

def uci_to_san(fen: str, uci_move: str) -> str:
    """
    Convert UCI move to SAN notation
    
    - **fen**: Current position in FEN
    - **uci_move**: Move in UCI format (e.g., "e2e4")
    """
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci_move)
        san = board.san(move)
        return san
    except Exception as e:
        return uci_move  # Return UCI if conversion fails

@router.post("/uci-to-san")
async def convert_uci_to_san(fen: str, uci_move: str):
    """
    Convert a UCI move to SAN notation
    """
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci_move)
        san = board.san(move)
        return {"uci": uci_move, "san": san, "fen": fen}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid move or FEN: {str(e)}")
