from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
import chess
import chess.pgn
import chess.pgn
from io import StringIO
import os

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
        raise HTTPException(status_code=503, detail=f"Lichess API unavailable: {str(e)}")

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

@router.get("/random")
async def get_random_puzzle(
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    theme: Optional[str] = None
):
    """
    Get a random puzzle from Lichess
    
    Note: Lichess API may have rate limits for random puzzles
    """
    try:
        # Lichess doesn't have a direct random endpoint with filters in free API
        # We'll use the daily puzzle for now
        # In production, you might scrape or use a puzzle database
        
        params = {}
        # Note: Lichess free API doesn't support these filters directly
        # This is a placeholder for future enhancement
        
        response = requests.get(
            f"{LICHESS_API_URL}/puzzle/daily",
            params=params,
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
        
        puzzle = Puzzle(
            id=puzzle_data.get("id", "random"),
            fen=game_data.get("fen", ""),
            rating=puzzle_data.get("rating", 1500),
            themes=puzzle_data.get("themes", []),
            solution=puzzle_data.get("solution", []),
            initial_move=puzzle_data.get("initialMove", "")
        )
        
        # Filter by rating if specified
        if rating_min and puzzle.rating < rating_min:
            return {"message": "Puzzle below minimum rating, try again"}
        if rating_max and puzzle.rating > rating_max:
            return {"message": "Puzzle above maximum rating, try again"}
        
        return PuzzleResponse(
            puzzle=puzzle,
            message="Random puzzle fetched successfully"
        )
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Lichess API unavailable: {str(e)}")

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
