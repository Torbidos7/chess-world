from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import chess
import chess.engine
import os
import asyncio
import requests

router = APIRouter(prefix="/api/engine", tags=["engine"])

# Configuration
STOCKFISH_PATH = os.getenv("STOCKFISH_PATH", "/usr/local/bin/stockfish")
CHESS_API_URL = os.getenv("CHESS_API_URL", "https://chess-api.com/v1")
CHESS_API_KEY = os.getenv("CHESS_API_KEY", "")

class EvaluationRequest(BaseModel):
    fen: str
    depth: Optional[int] = 20
    engine_type: Optional[str] = "stockfish"  # "stockfish" or "chess-api"

class MoveEvaluation(BaseModel):
    move_uci: str
    move_san: str
    eval_score: float
    mate_in: Optional[int] = None

class EvaluationResponse(BaseModel):
    fen: str
    eval_score: float
    best_move_uci: str
    best_move_san: str
    mate_in: Optional[int] = None
    principal_variation: List[str]
    win_chance: Optional[float] = None
    continuation: Optional[str] = None
    alternative_moves: Optional[List[MoveEvaluation]] = None  # Only for Stockfish
    engine_used: str

def calculate_win_chance(eval_score: float) -> float:
    """Convert centipawn evaluation to win probability"""
    # Using sigmoid function: 1 / (1 + 10^(-eval/400))
    if eval_score > 1000:
        return 99.9
    elif eval_score < -1000:
        return 0.1
    return 50 + 50 * (2 / (1 + 10 ** (-eval_score / 400)) - 1)

async def evaluate_with_stockfish(fen: str, depth: int = 20, multipv: int = 5) -> dict:
    """Evaluate position using local Stockfish engine"""
    try:
        # Check if Stockfish exists
        if not os.path.exists(STOCKFISH_PATH):
            raise HTTPException(
                status_code=500,
                detail=f"Stockfish not found at {STOCKFISH_PATH}. Please install: brew install stockfish"
            )
        
        board = chess.Board(fen)
        
        # Open engine
        transport, engine = await chess.engine.popen_uci(STOCKFISH_PATH)
        
        # Analyze with multiple PVs (for alternative moves)
        info = await engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
            multipv=multipv
        )
        
        await engine.quit()
        
        # Extract best move and alternatives
        if not info:
            raise HTTPException(status_code=400, detail="No analysis available")
        
        # Get the best move (first PV)
        best_pv = info[0] if isinstance(info, list) else info
        best_move = best_pv.get("pv")[0] if best_pv.get("pv") else None
        
        if not best_move:
            raise HTTPException(status_code=400, detail="No best move found")
        
        # Get evaluation score
        score = best_pv.get("score")
        eval_score = None
        mate_in = None
        
        if score:
            if score.is_mate():
                mate_in = score.relative.moves
                eval_score = 10000 if mate_in > 0 else -10000
            else:
                eval_score = score.relative.score() / 100.0  # Convert centipawns to pawns
        
        # Get principal variation
        pv_moves = best_pv.get("pv", [])
        pv_san = []
        temp_board = board.copy()
        for move in pv_moves[:5]:  # First 5 moves of PV
            san = temp_board.san(move)
            pv_san.append(san)
            temp_board.push(move)
        
        # Get alternative moves
        alternative_moves = []
        if isinstance(info, list) and len(info) > 1:
            for i, pv in enumerate(info[1:], 1):  # Skip first (best move)
                if i >= 5:  # Limit to top 5
                    break
                    
                alt_move = pv.get("pv")[0] if pv.get("pv") else None
                if not alt_move:
                    continue
                
                alt_score = pv.get("score")
                alt_eval = None
                alt_mate = None
                
                if alt_score:
                    if alt_score.is_mate():
                        alt_mate = alt_score.relative.moves
                        alt_eval = 10000 if alt_mate > 0 else -10000
                    else:
                        alt_eval = alt_score.relative.score() / 100.0
                
                alternative_moves.append({
                    "move_uci": alt_move.uci(),
                    "move_san": board.san(alt_move),
                    "eval_score": alt_eval or 0,
                    "mate_in": alt_mate
                })
        
        return {
            "fen": fen,
            "eval_score": eval_score or 0,
            "best_move_uci": best_move.uci(),
            "best_move_san": board.san(best_move),
            "mate_in": mate_in,
            "principal_variation": pv_san,
            "win_chance": calculate_win_chance(eval_score or 0),
            "continuation": " ".join(pv_san),
            "alternative_moves": alternative_moves,
            "engine_used": "stockfish"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stockfish error: {str(e)}")

async def evaluate_with_chess_api(fen: str, depth: int = 20) -> dict:
    """Evaluate position using chess-api.com"""
    try:
        headers = {}
        if CHESS_API_KEY:
            headers["X-API-Key"] = CHESS_API_KEY
        
        response = requests.post(
            CHESS_API_URL,
            json={"fen": fen, "depth": depth},
            headers=headers,
            timeout=30
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Chess API error: {response.text}"
            )
        
        data = response.json()
        
        # Parse chess-api.com response
        board = chess.Board(fen)
        move_uci = data.get("move", "")
        
        if not move_uci:
            raise HTTPException(status_code=400, detail="No move returned from API")
        
        # Convert UCI to SAN
        try:
            move = chess.Move.from_uci(move_uci)
            move_san = board.san(move)
        except:
            move_san = move_uci
        
        eval_score = data.get("eval", 0)
        mate_in = data.get("mate")
        
        # Get continuation if available
        continuation_arr = data.get("continuationArr", [])
        pv_san = continuation_arr[:5] if continuation_arr else []
        
        return {
            "fen": fen,
            "eval_score": eval_score,
            "best_move_uci": move_uci,
            "best_move_san": move_san,
            "mate_in": mate_in,
            "principal_variation": pv_san,
            "win_chance": calculate_win_chance(eval_score),
            "continuation": " ".join(pv_san),
            "alternative_moves": None,  # chess-api doesn't provide alternatives
            "engine_used": "chess-api"
        }
        
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=503, detail=f"Chess API unavailable: {str(e)}")

@router.post("/evaluate", response_model=EvaluationResponse)
async def evaluate_position(request: EvaluationRequest):
    """
    Evaluate a chess position using either Stockfish or chess-api.com
    
    - **fen**: FEN string of the position
    - **depth**: Analysis depth (default: 20)
    - **engine_type**: "stockfish" or "chess-api"
    
    Stockfish returns top 5 alternative moves, chess-api returns single best move
    """
    try:
        # Validate FEN
        chess.Board(request.fen)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid FEN: {str(e)}")
    
    # Choose engine
    if request.engine_type == "stockfish":
        try:
            return await evaluate_with_stockfish(request.fen, request.depth)
        except HTTPException as e:
            # Fallback to chess-api if Stockfish fails
            if e.status_code == 500:
                print(f"Stockfish failed, falling back to chess-api: {e.detail}")
                return await evaluate_with_chess_api(request.fen, request.depth)
            raise
    elif request.engine_type == "chess-api":
        return await evaluate_with_chess_api(request.fen, request.depth)
    else:
        raise HTTPException(status_code=400, detail="Invalid engine_type. Use 'stockfish' or 'chess-api'")

@router.get("/engines/available")
async def get_available_engines():
    """Check which engines are available"""
    engines = {
        "stockfish": {
            "available": os.path.exists(STOCKFISH_PATH),
            "path": STOCKFISH_PATH,
            "features": ["multiple_moves", "deep_analysis"]
        },
        "chess-api": {
            "available": True,  # Assume available (will fail in request if not)
            "url": CHESS_API_URL,
            "features": ["cloud_based", "fast"]
        }
    }
    return engines
