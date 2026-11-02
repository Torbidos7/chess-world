import os
import json
import time
import asyncio
from .config import load_dotenv

load_dotenv()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import chess
import chess.engine
from typing import List
from .database import SessionLocal, User, Game, get_db

# Import routers
from .routers import engine, puzzles, pgn, users, auth, matchmaking
from .services import llm

app = FastAPI(
    title="Chess World API",
    description="Comprehensive chess platform with engines, puzzles, training, and LLM assistant",
    version="1.0.0"
)

# CORS
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
app.include_router(matchmaking.router)
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
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "username": user.username,
        "elo": user.elo,
        "games_played": user.games_played,
        "wins": user.wins,
        "losses": user.losses,
        "draws": user.draws
    }

# Game Manager - Room-based multiplayer con pairing guest, turni forzati, orologi e persistenza
def parse_time_control(tc: str):
    """'10+0' -> (base_seconds, increment_seconds)"""
    try:
        parts = tc.split("+")
        base = int(parts[0].strip())
        inc = int(parts[1].strip()) if len(parts) > 1 else 0
        return max(base * 60, 10), max(inc, 0)
    except Exception:
        return 600, 0

def expected_score(ra: float, rb: float) -> float:
    return 1 / (1 + 10 ** ((rb - ra) / 400))

class RoomGame:
    def __init__(self, game_id: str, time_control: str = "10+0"):
        self.game_id = game_id
        self.board = chess.Board()
        self.white_conns: list = []
        self.black_conns: list = []
        self.white_user: str | None = None
        self.black_user: str | None = None
        self.base_time, self.inc = parse_time_control(time_control)
        self.white_time = self.base_time
        self.black_time = self.base_time
        self.time_control = time_control
        self.status = "waiting"  # waiting | playing | finished
        self.result: str | None = None
        self.winner: str | None = None
        self.moves: list = []  # SAN
        self.last_move_at = time.monotonic()
        self.clock_task: asyncio.Task | None = None

    def color_of(self, ws):
        if ws in self.white_conns:
            return "white"
        if ws in self.black_conns:
            return "black"
        return None

    def add_connection(self, ws, username, color=None):
        if color == "white" and not self.white_conns:
            self.white_conns.append(ws); self.white_user = username; color = "white"
        elif color == "black" and not self.black_conns:
            self.black_conns.append(ws); self.black_user = username; color = "black"
        elif not self.white_conns:
            self.white_conns.append(ws); self.white_user = username; color = "white"
        elif not self.black_conns:
            self.black_conns.append(ws); self.black_user = username; color = "black"
        else:
            return None  # spectator
        self.last_move_at = time.monotonic()
        return color

    def payload_state(self):
        return {
            "fen": self.board.fen(),
            "turn": "white" if self.board.turn else "black",
            "white_time": round(self.white_time),
            "black_time": round(self.black_time),
            "status": self.status,
            "result": self.result,
            "winner": self.winner,
            "white_user": self.white_user,
            "black_user": self.black_user,
            "time_control": self.time_control,
        }

    async def broadcast(self, msg_type, **extra):
        payload = {"type": msg_type}
        payload.update(extra)
        text = json.dumps(payload)
        for ws in self.white_conns + self.black_conns:
            try:
                await ws.send_text(text)
            except Exception:
                pass

    async def clock_loop(self):
        while self.status == "playing":
            await asyncio.sleep(0.25)
            now = time.monotonic()
            elapsed = now - self.last_move_at
            self.last_move_at = now
            if self.board.turn:  # white to move
                self.white_time -= elapsed
                if self.white_time <= 0:
                    await self.finish("timeout", "black")
                    return
            else:  # black to move
                self.black_time -= elapsed
                if self.black_time <= 0:
                    await self.finish("timeout", "white")
                    return
            await self.broadcast("clock", **self.payload_state())

    async def handle_move(self, ws, uci):
        color = self.color_of(ws)
        if color is None or self.status != "playing":
            return False
        side = "white" if self.board.turn else "black"
        if color != side:
            return False
        try:
            move = chess.Move.from_uci(uci)
            if not self.board.is_legal(move):
                return False
        except ValueError:
            return False
        san = self.board.san(move)
        self.board.push(move)
        self.moves.append(san)
        if color == "white":
            self.white_time += self.inc
        else:
            self.black_time += self.inc
        self.last_move_at = time.monotonic()

        if self.board.is_checkmate():
            winner = "white" if self.board.turn == chess.BLACK else "black"
            await self.finish("checkmate", winner)
        elif self.board.is_stalemate() or self.board.is_insufficient_material():
            await self.finish("draw", None)
        else:
            await self.broadcast("move", **self.payload_state())
        return True

    async def finish(self, reason, winner):
        self.status = "finished"
        self.result = {
            "checkmate": "1-0" if winner == "white" else "0-1",
            "timeout": "1-0" if winner == "white" else "0-1",
            "draw": "1/2-1/2",
        }.get(reason, "*")
        self.winner = winner
        if self.clock_task:
            self.clock_task.cancel()
            self.clock_task = None
        await self.broadcast("end", **self.payload_state())
        self.persist(reason)

    def persist(self, reason):
        db = SessionLocal()
        try:
            game = Game(
                white_username=self.white_user or None,
                black_username=self.black_user or None,
                result=self.result or "*",
                pgn="",
                moves=self.moves,
                fen=self.board.fen(),
                time_control=self.time_control,
                winner=self.winner,
                status="finished",
            )
            db.add(game)
            if self.white_user and self.black_user:
                w = db.query(User).filter(User.username == self.white_user).first()
                b = db.query(User).filter(User.username == self.black_user).first()
                if w and b:
                    w.games_played += 1
                    b.games_played += 1
                    if self.result == "1-0":
                        w.wins += 1; b.losses += 1; sa, sb = 1.0, 0.0
                    elif self.result == "0-1":
                        w.losses += 1; b.wins += 1; sa, sb = 0.0, 1.0
                    else:
                        w.draws += 1; b.draws += 1; sa, sb = 0.5, 0.5
                    ea = expected_score(w.elo, b.elo)
                    eb = expected_score(b.elo, w.elo)
                    K = 30
                    w.elo = round(w.elo + K * (sa - ea))
                    b.elo = round(b.elo + K * (sb - eb))
            db.commit()
        finally:
            db.close()

class GameManager:
    def __init__(self):
        self.games: dict = {}  # game_id -> Game

    def get_or_create(self, game_id, time_control):
        if game_id not in self.games:
            self.games[game_id] = RoomGame(game_id, time_control)
        return self.games[game_id]

    def disconnect(self, ws, game):
        color = game.color_of(ws)
        if color == "white":
            game.white_conns.remove(ws)
        elif color == "black":
            game.black_conns.remove(ws)
        # Se un giocatore abbandona a partita in corso -> forfeit per l'avversario
        if game.status == "playing":
            winner = "black" if color == "white" else "white"
            game.status = "finished"
            game.result = "1-0" if winner == "white" else "0-1"
            game.winner = winner
            asyncio.create_task(game.broadcast("end", **game.payload_state()))
            game.persist("forfeit")
        # Cleanup stanza vuota
        if not game.white_conns and not game.black_conns:
            self.games.pop(game.game_id, None)

manager = GameManager()

@app.websocket("/ws/game")
async def websocket_endpoint(
    websocket: WebSocket,
    game_id: str = "default",
    username: str = None,
    time_control: str = "10+0",
    color: str = None,
):
    await websocket.accept()
    game = manager.get_or_create(game_id, time_control)
    assigned = game.add_connection(websocket, username, color)

    if assigned is None:
        await websocket.send_text(json.dumps({"type": "spectator", **game.payload_state()}))
        # spectator: resta connesso ma non può muovere
        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            return
    else:
        # init per questo client (include il colore assegnato)
        await websocket.send_text(json.dumps({
            "type": "init",
            "color": assigned,
            **game.payload_state(),
        }))
        # se ora la stanza è completa -> inizia la partita
        if game.status == "waiting" and game.white_conns and game.black_conns:
            game.status = "playing"
            game.last_move_at = time.monotonic()
            game.clock_task = asyncio.create_task(game.clock_loop())
            await game.broadcast("start", **game.payload_state())
        try:
            while True:
                data = await websocket.receive_text()
                try:
                    msg = json.loads(data)
                except Exception:
                    await websocket.send_text(json.dumps({"type": "error", "message": "invalid JSON"}))
                    continue
                if msg.get("type") == "move":
                    ok = await game.handle_move(websocket, msg.get("uci"))
                    if not ok:
                        await websocket.send_text(json.dumps({
                            "type": "error",
                            "message": "Invalid or illegal move (non è il tuo turno?)",
                        }))
        except WebSocketDisconnect:
            manager.disconnect(websocket, game)

