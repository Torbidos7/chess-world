from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import requests
import chess
import os
from ..config import load_dotenv

load_dotenv()

from ..services.puzzle_db import puzzle_db


router = APIRouter(prefix="/api/puzzles", tags=["puzzles"])

LICHESS_API_URL = os.getenv("LICHESS_API_URL", "https://lichess.org/api")

# Cache in-memory della soluzione per puzzle_id, per la validazione reale
_solution_cache: dict = {}
_MAX_CACHE = 200


class Puzzle(BaseModel):
    id: str
    fen: str
    rating: int
    themes: List[str]
    solution: List[str]  # UCI moves (giocatore + avversario, dalla posizione del puzzle)
    initial_move: str  # First move (opponent's) - non usato: il fen è già la posizione

class PuzzleResponse(BaseModel):
    puzzle: Puzzle
    message: str

class ValidateMoveRequest(BaseModel):
    puzzle_id: str
    move_uci: str
    solution_index: int

def _cache_solution(puzzle_id: str, solution: List[str]):
    _solution_cache[puzzle_id] = solution
    if len(_solution_cache) > _MAX_CACHE:
        _solution_cache.pop(next(iter(_solution_cache)), None)


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
        puzzle_data = data.get("puzzle", {})
        fen = puzzle_data.get("fen", "")
        if not fen:
            raise HTTPException(status_code=500, detail="Lichess puzzle has no FEN")

        solution = puzzle_data.get("solution", [])
        puzzle = Puzzle(
            id=puzzle_data.get("id", "daily"),
            fen=fen,
            rating=puzzle_data.get("rating", 1500),
            themes=puzzle_data.get("themes", []),
            solution=solution,
            initial_move="",
        )
        _cache_solution(puzzle.id, solution)
        _cache_solution("daily", solution)  # alias per compatibilità

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
    Validate a player's move against the puzzle solution.

    - **puzzle_id**: ID of the puzzle
    - **move_uci**: Player's move in UCI format
    - **solution_index**: Index of the player's move in the solution
    """
    solution = _solution_cache.get(request.puzzle_id)
    if solution is None:
        return {
            "correct": False,
            "message": "Puzzle solution not cached — fetch the puzzle first",
            "next_index": request.solution_index,
        }

    expected = solution[request.solution_index] if request.solution_index < len(solution) else None
    if expected is None:
        return {
            "correct": False,
            "message": "Solution index out of range",
            "next_index": request.solution_index,
        }

    correct = request.move_uci == expected
    # Se l'indice è pari la mossa è del giocatore; se dispari è dell'avversario
    # (non è il turno del giocatore) -> sempre errato per il solver.
    if request.solution_index % 2 == 1:
        correct = False

    return {
        "correct": correct,
        "message": "Move validated" if correct else "Wrong move — try again",
        "next_index": request.solution_index + 1 if correct else request.solution_index,
        "expected": expected,
    }


@router.get("/random")
async def get_random_puzzle(
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    theme: Optional[str] = None,
):
    """
    Get a random puzzle dal bundle locale (offline, affidabile).
    Filtro opzionale per rating e theme.
    """
    puzzle_data = puzzle_db.get_random_puzzle(rating_min, rating_max, theme)
    if not puzzle_data:
        raise HTTPException(status_code=404, detail="No puzzles available")

    puzzle = Puzzle(
        id=puzzle_data['id'],
        fen=puzzle_data['fen'],
        rating=puzzle_data['rating'],
        themes=puzzle_data['themes'],
        solution=puzzle_data['solution'],
        initial_move=puzzle_data['initial_move'],
    )
    _cache_solution(puzzle.id, puzzle.solution)

    return PuzzleResponse(
        puzzle=puzzle,
        message=f"Random puzzle fetched (Rating: {puzzle.rating})"
    )


@router.get("/local")
async def get_local_puzzle(
    rating_min: Optional[int] = None,
    rating_max: Optional[int] = None,
    theme: Optional[str] = None,
):
    """
    Get a random puzzle from local database (bundle offline).
    """
    puzzle_data = puzzle_db.get_random_puzzle(rating_min, rating_max, theme)

    if not puzzle_data:
        raise HTTPException(status_code=404, detail="No puzzles found in local database")

    puzzle = Puzzle(
        id=puzzle_data['id'],
        fen=puzzle_data['fen'],
        rating=puzzle_data['rating'],
        themes=puzzle_data['themes'],
        solution=puzzle_data['solution'],
        initial_move=puzzle_data['initial_move'],
    )
    _cache_solution(puzzle.id, puzzle.solution)

    return PuzzleResponse(
        puzzle=puzzle,
        message=f"Local puzzle fetched (Rating: {puzzle.rating})"
    )


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
