# Chess World - Features & Architecture

## 1. Architecture Overview

### Frontend
- **Framework**: React (Vite)
- **Styling**: Tailwind CSS + Lucide Icons
- **Chess Logic**: `chess.js` (Game state), `react-chessboard` (UI)
- **Communication**: WebSocket (`/ws/game`) for real-time moves, REST API for other data.

### Backend
- **Framework**: FastAPI (Python)
- **Chess Engine**: `python-chess` (Rule enforcement), Stockfish (Analysis)
- **AI/LLM**: Ollama integration (supports `gemma3:27b`, `llama3.2-vision`)
- **Database**: SQLite (`chess_world.db`) via SQLAlchemy

## 2. Key Features

### Interactive Chessboard
- **Real-time Updates**: Moves are sent to the backend via WebSocket. The backend validates the move using `python-chess` and broadcasts the new FEN.
- **Optimistic UI**: The frontend updates the board immediately for a responsive feel, but reverts if the backend rejects the move (e.g., illegal move).
- **Visual Feedback**: Legal moves are highlighted (if enabled), and check/checkmate states are displayed.

### AI Assistant (Chat)
- **Integration**: Connects to a local Ollama instance.
- **Context Awareness**: The assistant knows the current board state (FEN) and can analyze positions.
- **Multimodal**: Supports image analysis if a vision model is used.
- **Dynamic Model Selection**: Automatically detects available models (e.g., `gemma3:27b`) to ensure functionality without complex configuration.

### Training Mode
- **PGN Loading**: Parse and replay games from PGN files.
- **Engine Analysis**: Toggle between Stockfish (local) and external APIs for position evaluation.
- **Best Move Suggestions**: The engine suggests the best continuation.

### Problems Mode
- **Puzzle API**: Fetches puzzles from Lichess/RapidAPI.
- **Interactive Solving**: Users make moves, and the system responds with the opponent's move.

## 3. Data Flow

1.  **Move Made**: User drags piece -> `makeMove` (Frontend)
2.  **Validation (Local)**: `chess.js` checks basic legality.
3.  **Transmission**: UCI move (e.g., "e2e4") sent via WebSocket.
4.  **Validation (Server)**: `python-chess` enforces strict rules (checks, pins, etc.).
5.  **Update**:
    - **Valid**: Server updates board, sends new FEN. Frontend confirms.
    - **Invalid**: Server sends "error". Frontend reverts board.

## 4. Deployment
- **Frontend**: Ready for GitHub Pages (build with `npm run build`).
- **Backend**: Python-based, requires `uvicorn` and `stockfish` (optional).
