import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';

export const useChessGame = () => {
    const [game, setGame] = useState(new Chess());
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        // Connect to Backend WebSocket
        // In production, this URL should be configurable
        const ws = new WebSocket('ws://localhost:8000/ws/game');

        ws.onopen = () => {
            console.log('Connected to Chess Server');
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const message = event.data;
            console.log('Received message from backend:', message);

            if (message.startsWith('error:')) {
                console.error('Backend rejected move:', message);
                // Revert to previous state by forcing a re-render with current game state
                // We need to trigger a state update even if the object is the same, 
                // but ideally we should undo the move in the local state if we want to be precise.
                // However, since we don't track history deeply here, we can just create a new Chess instance
                // from the *current* valid FEN (which we might have lost if we updated optimistically).

                // BETTER APPROACH: Request the correct FEN from backend? 
                // The backend only sends FEN on valid move.
                // Let's just undo the last move locally if it was optimistic.
                setGame(currentGame => {
                    const newGame = new Chess(currentGame.fen());
                    newGame.undo(); // Undo the optimistic move
                    console.log('Reverted board to:', newGame.fen());
                    return newGame;
                });
                return;
            }

            const fen = message;

            // Only update if FEN is actually different to avoid resetting during drag
            setGame(currentGame => {
                // If the backend confirms the move, the FEN will match our optimistic FEN.
                if (currentGame.fen() === fen) {
                    console.log('FEN matches current state (move confirmed), skipping re-render');
                    return currentGame;
                }

                try {
                    const newGame = new Chess(fen);
                    console.log('Updated game from backend (sync)');
                    return newGame;
                } catch (e) {
                    console.error('Invalid FEN received:', fen, e);
                    return currentGame;
                }
            });
        };

        ws.onclose = () => {
            console.log('Disconnected from Chess Server');
            setIsConnected(false);
        };

        socketRef.current = ws;

        return () => {
            if (ws.readyState === 1) { // OPEN
                ws.close();
            }
        };
    }, []);

    const makeMove = useCallback((sourceSquare, targetSquare) => {
        console.log('makeMove called:', sourceSquare, '->', targetSquare);
        let move = null;
        const newGame = new Chess(game.fen());

        try {
            move = newGame.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: 'q',
            });
        } catch (e) {
            console.error('Move failed:', e);
            return false;
        }

        if (move) {
            console.log('Move made locally:', move.san, 'UCI:', move.from + move.to);
            setGame(newGame); // Optimistic update
            if (socketRef.current && socketRef.current.readyState === 1) {
                console.log('Sending move to backend:', move.from + move.to);
                socketRef.current.send(move.from + move.to); // Send UCI move to backend
            }
            return true;
        }
        return false;
    }, [game]);

    const resetGame = useCallback(() => {
        const newGame = new Chess();
        setGame(newGame);
        // TODO: Send reset command to backend
    }, []);

    return {
        game,
        makeMove,
        resetGame,
        isConnected
    };
};
