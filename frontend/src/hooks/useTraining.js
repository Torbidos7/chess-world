import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useTraining = () => {
    const [sessionId, setSessionId] = useState(null);
    const [games, setGames] = useState([]);
    const [currentGame, setCurrentGame] = useState(null);
    const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const uploadPGN = useCallback(async (file) => {
        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post(`${API_URL}/api/pgn/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSessionId(response.data.session_id);
            setGames(response.data.games);
            return response.data;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to upload PGN';
            setError(errorMsg);
            console.error('PGN upload error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const loadGame = useCallback(async (gameIndex) => {
        if (!sessionId) return null;

        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_URL}/api/pgn/game/${sessionId}/${gameIndex}`);
            setCurrentGame(response.data);
            setCurrentMoveIndex(0);
            return response.data;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to load game';
            setError(errorMsg);
            console.error('PGN load error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    const navigateToMove = useCallback((moveIndex) => {
        if (!currentGame) return null;

        if (moveIndex < 0 || moveIndex > currentGame.moves.length) {
            return null;
        }

        setCurrentMoveIndex(moveIndex);
        return currentGame.fen_positions[moveIndex];
    }, [currentGame]);

    const nextMove = useCallback(() => {
        if (!currentGame) return null;
        const newIndex = Math.min(currentMoveIndex + 1, currentGame.moves.length);
        setCurrentMoveIndex(newIndex);
        return currentGame.fen_positions[newIndex];
    }, [currentGame, currentMoveIndex]);

    const previousMove = useCallback(() => {
        const newIndex = Math.max(currentMoveIndex - 1, 0);
        setCurrentMoveIndex(newIndex);
        return currentGame?.fen_positions[newIndex] || null;
    }, [currentGame, currentMoveIndex]);

    const firstMove = useCallback(() => {
        setCurrentMoveIndex(0);
        return currentGame?.fen_positions[0] || null;
    }, [currentGame]);

    const lastMove = useCallback(() => {
        if (!currentGame) return null;
        const lastIndex = currentGame.moves.length;
        setCurrentMoveIndex(lastIndex);
        return currentGame.fen_positions[lastIndex];
    }, [currentGame]);

    const getCurrentFEN = useCallback(() => {
        return currentGame?.fen_positions[currentMoveIndex] || null;
    }, [currentGame, currentMoveIndex]);

    return {
        sessionId,
        games,
        currentGame,
        currentMoveIndex,
        loading,
        error,
        uploadPGN,
        loadGame,
        navigateToMove,
        nextMove,
        previousMove,
        firstMove,
        lastMove,
        getCurrentFEN
    };
};
