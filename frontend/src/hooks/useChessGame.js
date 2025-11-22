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
            const fen = event.data;
            console.log('Received FEN from backend:', fen);

            // Only update if FEN is actually different to avoid resetting during drag
            setGame(currentGame => {
                if (currentGame.fen() === fen) {
                    console.log('FEN unchanged, skipping update');
                    return currentGame;
                }

                try {
                    const newGame = new Chess(fen);
                    console.log('Updated game from backend');
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
