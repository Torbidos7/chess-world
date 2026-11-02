import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';

export const useChessGame = (gameId = 'default', opts = {}) => {
    const { username = null, color = null, timeControl = '10+0' } = opts;
    const [game, setGame] = useState(new Chess());
    const [isConnected, setIsConnected] = useState(false);
    const [playerColor, setPlayerColor] = useState(null);
    const [whiteTime, setWhiteTime] = useState(600);
    const [blackTime, setBlackTime] = useState(600);
    const [turn, setTurn] = useState('white');
    const [gameStatus, setGameStatus] = useState('waiting');
    const [result, setResult] = useState(null);
    const [winner, setWinner] = useState(null);
    const [whiteUser, setWhiteUser] = useState(null);
    const [blackUser, setBlackUser] = useState(null);
    const wsRef = useRef(null);

    useEffect(() => {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
        const wsProtocol = apiUrl.startsWith('https') ? 'wss' : 'ws';
        const wsHost = apiUrl.replace(/^https?:\/\//, '');
        const params = new URLSearchParams();
        params.set('game_id', gameId);
        if (username) params.set('username', username);
        if (color) params.set('color', color);
        params.set('time_control', timeControl);
        const wsUrl = `${wsProtocol}://${wsHost}/ws/game?${params.toString()}`;

        console.log('Connecting to WebSocket:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WebSocket connected to game:', gameId);
            setIsConnected(true);
        };

        ws.onmessage = (event) => {
            let msg;
            try {
                msg = JSON.parse(event.data);
            } catch {
                console.error('Bad WS message:', event.data);
                return;
            }
            console.log('WS message:', msg.type, msg);

            if (msg.type === 'error') {
                alert(msg.message);
                return;
            }

            // Aggiorna lo stato condiviso (fen/turno/orologi/status)
            if (msg.fen) {
                setGame(new Chess(msg.fen));
            }
            if (msg.turn) setTurn(msg.turn);
            if (msg.white_time !== undefined) setWhiteTime(msg.white_time);
            if (msg.black_time !== undefined) setBlackTime(msg.black_time);
            if (msg.status) setGameStatus(msg.status);
            if (msg.result) setResult(msg.result);
            if (msg.winner) setWinner(msg.winner);
            if (msg.white_user) setWhiteUser(msg.white_user);
            if (msg.black_user) setBlackUser(msg.black_user);

            if (msg.type === 'init') {
                setPlayerColor(msg.color);
                setGameStatus(msg.status);
            }
            if (msg.type === 'start') {
                setGameStatus('playing');
            }
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
    }, [gameId, username, color, timeControl]);

    const makeMove = useCallback((sourceSquare, targetSquare) => {
        // Turni forzati: solo se è il colore del giocatore e la partita è in corso
        if (gameStatus !== 'playing') return false;
        if (!playerColor || playerColor !== turn) return false;

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
            setGame(newGame); // Optimistic update
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'move', uci: move.from + move.to }));
            }
            return true;
        }
        return false;
    }, [game, gameStatus, playerColor, turn]);

    const resetGame = useCallback(() => {
        const newGame = new Chess();
        setGame(newGame);
        setResult(null);
        setWinner(null);
        setGameStatus('waiting');
        setTurn('white');
        setPlayerColor(null);
        setWhiteTime(600);
        setBlackTime(600);
        setWhiteUser(null);
        setBlackUser(null);
    }, []);

    const undoMove = useCallback(() => {
        setGame(currentGame => {
            const newGame = new Chess(currentGame.fen());
            newGame.undo();
            return newGame;
        });
    }, []);

    return {
        game,
        makeMove,
        resetGame,
        undoMove,
        isConnected,
        playerColor,
        whiteTime,
        blackTime,
        turn,
        gameStatus,
        result,
        winner,
        whiteUser,
        blackUser,
    };
};
