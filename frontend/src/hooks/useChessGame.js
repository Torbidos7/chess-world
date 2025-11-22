import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';

export const useChessGame = (gameId = 'default') => {
    const [game, setGame] = useState(new Chess());
    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef(null);

    useEffect(() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.hostname}:8000/ws/game?game_id=${gameId}`;

        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected to game:', gameId);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            const data = event.data;
            console.log('WebSocket message received:', data);

            // Check if it's an error message
            if (data.startsWith('error:')) {
                console.error('Move rejected by server:', data);
                alert(data.substring(6)); // Remove "error:" prefix
                // Revert to previous state by resetting game
                setGame(currentGame => {
                    const revertedGame = new Chess();
                    revertedGame.load(currentGame.fen());
                    return revertedGame;
                });
                return;
            }

            // FEN update from server
            const fen = data;
            setGame(currentGame => {
                const newGame = new Chess(fen);
                console.log('Board updated:', newGame.ascii());
                return newGame;
            });
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setIsConnected(false);
        };

        ws.onclose = () => {
            console.log('WebSocket disconnected');
            setIsConnected(false);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        };
    }, [gameId]);

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
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                console.log('Sending move to backend:', move.from + move.to);
                wsRef.current.send(move.from + move.to); // Send UCI move to backend
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
