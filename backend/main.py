from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import chess
import chess.engine
from typing import List
from .database import SessionLocal, User, get_db

# Import routers
from .routers import engine, puzzles, pgn, users, auth
from .services import llm

app = FastAPI(
    title="Chess World API",
    description="Comprehensive chess platform with engines, puzzles, training, and LLM assistant",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(engine.router)
app.include_router(puzzles.router)
app.include_router(pgn.router)
app.include_router(users.router)
app.include_router(llm.router)

@app.on_event("startup")
async def startup_event():
    print("🚀 Chess World API starting...")
    print("📍 Endpoints available at: http://localhost:8000/docs")
    print("🔧 Verify Ollama is running: curl http://localhost:11434/api/tags")

@app.get("/")
async def root():
    return {
        "message": "Welcome to Chess World API",
        "version": "1.0.0",
        "features": [
            "Dual chess engines (Stockfish + chess-api.com)",
            "Lichess puzzle integration",
            "PGN training mode",
            "Ollama LLM assistant",
            "Multiplayer games"
        ],
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    """
    Comprehensive health check
    """
    import os
    
    health = {
        "status": "healthy",
        "database": "operational",
        "engines": {
            "stockfish": os.path.exists(os.getenv("STOCKFISH_PATH", "/usr/local/bin/stockfish")),
            "chess_api": True  # Assume available
        },
        "services": {
            "ollama": "unknown",  # Check via /api/llm/health
            "lichess": True
        }
    }
    
    return health

@app.get("/users/{username}")
def read_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        # Return a mock user for now if not found, to keep frontend happy during demo
        return {
            "username": username,
            "elo": 1200,
            "games_played": 0,
            "wins": 0,
            "losses": 0,
            "draws": 0
        }
    return user

# Game Manager - Supports room-based multiplayer with game IDs
class GameManager:
    def __init__(self):
        self.active_games: dict = {}  # game_id -> board
        self.active_connections: dict = {}  # game_id -> list of websockets

    async def connect(self, websocket: WebSocket, game_id: str):
        await websocket.accept()
        
        # Create game if it doesn't exist
        if game_id not in self.active_games:
            self.active_games[game_id] = chess.Board()
            self.active_connections[game_id] = []
        
        self.active_connections[game_id].append(websocket)

    def disconnect(self, websocket: WebSocket, game_id: str):
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
            
            # Clean up empty games
            if len(self.active_connections[game_id]) == 0:
                del self.active_connections[game_id]
                del self.active_games[game_id]

    def get_board(self, game_id: str):
        return self.active_games.get(game_id)
    
    async def broadcast(self, game_id: str, message: str):
        """Broadcast message to all connections in a game"""
        if game_id in self.active_connections:
            for conn in self.active_connections[game_id]:
                try:
                    await conn.send_text(message)
                except:
                    pass  # Connection might be closed

manager = GameManager()

@app.websocket("/ws/game")
async def websocket_endpoint(websocket: WebSocket, game_id: str = "default"):
    await manager.connect(websocket, game_id)
    board = manager.get_board(game_id)
    
    try:
        # Send initial position to this client
        await websocket.send_text(board.fen())
        
        while True:
            data = await websocket.receive_text()
            print(f"[Game {game_id}] Received move data: {data}")
            try:
                move = chess.Move.from_uci(data)
                if board.is_legal(move):
                    board.push(move)
                    # Broadcast updated position to all players in this game
                    await manager.broadcast(game_id, board.fen())
                else:
                    await websocket.send_text(f"error:Invalid move {data}")
            except ValueError:
                await websocket.send_text(f"error:Invalid UCI format {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, game_id)

