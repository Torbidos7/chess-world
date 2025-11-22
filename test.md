# Chess World - Test Plan

This document outlines the manual test steps to verify the functionality of the Chess World application.

## 1. Backend Health Check
- [ ] **Verify Server Startup**: Ensure the backend server starts without errors (`uvicorn main:app --reload`).
- [ ] **Check API Health**: Visit `http://localhost:8000/` and verify the welcome message "Welcome to Chess World API".
- [ ] **Check API Docs**: Visit `http://localhost:8000/docs` and ensure Swagger UI loads.

## 2. Frontend Initialization
- [ ] **Verify Client Startup**: Ensure the frontend dev server starts (`npm run dev`).
- [ ] **Check Home Page**: Visit `http://localhost:5173` (or the active port) and verify the landing page loads with the "Chess World" title and navigation menu.
- [ ] **Check Navigation**: Click on "Play", "Training", and "Problems" in the sidebar and verify the views switch correctly.

## 3. Play Mode (PvP / Sandbox)
- [ ] **Board Rendering**: Verify the chessboard appears with pieces in the starting position.
- [ ] **Connection Status**: Check the WiFi icon in the top right of the board. Green = Connected, Red = Disconnected.
- [ ] **Piece Movement**:
    - [ ] Drag and drop a white pawn from e2 to e4. Verify it moves.
    - [ ] Verify the move is reflected in the backend logs (if visible) or that the board state updates.
    - [ ] Try an illegal move (e.g., knight to a blocked square). Verify the piece snaps back.
- [ ] **Game State**:
    - [ ] Play a few moves (e.g., 1. e4 e5 2. Nf3 Nc6).
    - [ ] Refresh the page. Verify the board resets to the starting position (since we are using per-connection sessions).
- [ ] **Reset Game**: Click the "Reset Game" button. Verify pieces return to start.

## 4. Training Mode (Analysis & PGN)
- [ ] **Engine Toggle**:
    - [ ] Click the engine toggle button (Stockfish / chess-api). Verify the label changes.
- [ ] **Analysis**:
    - [ ] Make a move on the board.
    - [ ] Click "Analyze".
    - [ ] Verify a loading spinner appears.
    - [ ] Verify evaluation results appear (Score, Best Move, Win Chance).
    - [ ] If using Stockfish, verify alternative lines are shown.
- [ ] **"Play it" Button**:
    - [ ] After analysis, click "Play it" next to the best move.
    - [ ] Verify the piece moves on the board automatically.
- [ ] **PGN Upload**:
    - [ ] Click "Load PGN" and select a valid `.pgn` file.
    - [ ] Verify the game details (White vs Black) appear.
    - [ ] Verify the "Games in PGN" list is populated (if multiple games).
- [ ] **Navigation**:
    - [ ] Use the arrow buttons (<, >, <<, >>).
    - [ ] Verify the board updates to reflect the moves in the PGN.

## 5. Problems Mode (Puzzles)
- [ ] **Initial Load**:
    - [ ] Verify a puzzle loads automatically on entering the tab.
    - [ ] Verify the board is NOT in the starting position (it should match the puzzle FEN).
    - [ ] Verify puzzle details (Rating, Themes) are displayed.
- [ ] **Solving**:
    - [ ] Make the correct move for the puzzle.
    - [ ] Verify the opponent (computer) automatically responds.
    - [ ] Complete the puzzle. Verify the "Puzzle Solved!" overlay appears.
- [ ] **Failure**:
    - [ ] Make an incorrect move.
    - [ ] Verify the "Not Quite!" overlay appears.
    - [ ] Click "Try Again" and verify the board resets to the puzzle start.
- [ ] **New Puzzle**:
    - [ ] Click "New Puzzle".
    - [ ] Verify a different puzzle loads and the board updates.

## 6. AI Assistant (LLM)
- [ ] **Chat Interface**:
    - [ ] Open the chat sidebar.
    - [ ] Type "Hello". Verify the AI responds.
- [ ] **Chess Context**:
    - [ ] Ask "What is the current position?".
    - [ ] Verify the AI acknowledges the FEN or board state (if connected).
- [ ] **Screenshot Analysis** (If Ollama Vision is set up):
    - [ ] Click the Camera icon.
    - [ ] Ask "Analyze this position".
    - [ ] Verify the AI provides insights based on the board image.

## 7. WebSocket Connectivity
- [ ] **Reconnection**:
    - [ ] Stop the backend server.
    - [ ] Verify the frontend shows the disconnected icon (Red WiFi).
    - [ ] Restart the backend.
    - [ ] Verify the frontend reconnects automatically (Green WiFi).
