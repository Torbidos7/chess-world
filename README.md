# Chess World

A minimal and modern Chess platform built with React and Python.

## 🌟 App Features

### 1. **Play (New Game)**
The core of Chess World.
- **Interactive Board**: A smooth, responsive chessboard powered by `react-chessboard` and `chess.js`.
- **Real-time Multiplayer**: Moves are synchronized instantly across all connected clients using WebSockets.
- **Legal Move Validation**: The game logic prevents illegal moves and handles special rules like castling, en passant, and promotion.

### 2. **Training Mode**
Improve your game with AI assistance and study famous games.
- **Stockfish Integration**: We use the `chess-api.com` API to provide real-time evaluation of your position.
- **Best Move Suggestion**: Stuck? Click "Analyze Position" to see the engine's recommended move and the continuation line.
- **PGN Loading**: Upload your own PGN files (or use our examples like `CatalanClosed.pgn`) to analyze specific games or openings.
- **Legal Move Highlighting**: Drag a piece to see all possible legal moves, helping you learn piece movement and avoid blunders.
- **Evaluation Bar**: Visual feedback on who is winning (Positive for White, Negative for Black).

![Training Mode](training_fixed.png)

### 3. **Problems Mode**
Sharpen your tactical skills.
- **Daily Puzzles**: Fetches fresh chess puzzles from the Lichess database.
- **Interactive Solving**: Make moves on the board to solve the puzzle.
- **Feedback**: Instant feedback on whether your move was correct or incorrect.
- **Themes & Rating**: See the puzzle's difficulty rating and tactical themes (e.g., "Pin", "Fork").

![Problems Mode](problems_fixed.png)

### 4. **Profile**
Track your progress.
- **Player Stats**: View your Elo rating, games played, win/loss/draw record.
- **Match History**: See your recent games and performance.
- **Clean UI**: A modern, distraction-free interface to focus on your stats.

![Profile Mode](profile_fixed.png)

---

## 🔧 Backend Implementation

The backend is built with **Python (FastAPI)** and serves as the central nervous system of the application.

### **1. API Structure (`main.py`)**
- **FastAPI**: We chose FastAPI for its speed and automatic documentation.
- **Endpoints**:
    - `GET /`: Health check.
    - `GET /users/{username}`: Fetches user profile data from the database.
    - `WS /ws/game`: The WebSocket endpoint for real-time game communication.

### **2. Real-time Communication (WebSockets)**
- We use FastAPI's `WebSocket` support to create a persistent connection between the client and server.
- **GameManager Class**: Manages active connections and the global game state. When a player makes a move, it is sent to the server, validated by `python-chess`, and then broadcast to all other connected clients.

### **3. Database (`database.py`)**
- **SQLAlchemy**: We use SQLAlchemy as the ORM (Object Relational Mapper) to interact with the database.
- **SQLite**: For development, we use a local SQLite file (`chess_world.db`).
- **User Model**: Defines the schema for storing user data (username, elo, stats).

### **4. Game Logic**
- **python-chess**: This powerful library handles all the heavy lifting for chess rules (move generation, validation, FEN parsing) on the server side, ensuring no illegal moves can be forced by a hacked client.

---

## 🚀 Deployment Guide

### **Frontend (GitHub Pages)**
1.  Build the project:
    ```bash
    cd frontend
    npm run build
    ```
2.  Deploy the `dist` folder to GitHub Pages (automated via GitHub Actions).

### **Backend (e.g., Render.com)**
1.  Create a new Web Service on Render.
2.  Connect this repository.
3.  Set Build Command: `pip install -r backend/requirements.txt`
4.  Set Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

## 💻 Local Development

1.  **Backend**:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    pip install -r backend/requirements.txt
    uvicorn backend.main:app --reload
    ```

2.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 👥 Contributors

- **Google Antigravity** - *AI Co-pilot & Architect*
- **Daniele Buschi** - *Lead Developer*
