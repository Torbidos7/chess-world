import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const usePuzzle = () => {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [solutionIndex, setSolutionIndex] = useState(0);

    const fetchDailyPuzzle = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await axios.get(`${API_URL}/api/puzzles/daily`);
            setPuzzle(response.data.puzzle);
            setSolutionIndex(0);
            return response.data.puzzle;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to fetch puzzle';
            setError(errorMsg);
            console.error('Puzzle error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchRandomPuzzle = useCallback(async (ratingMin, ratingMax, theme) => {
        setLoading(true);
        setError(null);

        try {
            const params = {};
            if (ratingMin) params.rating_min = ratingMin;
            if (ratingMax) params.rating_max = ratingMax;
            if (theme) params.theme = theme;

            const response = await axios.get(`${API_URL}/api/puzzles/random`, { params });
            setPuzzle(response.data.puzzle);
            setSolutionIndex(0);
            return response.data.puzzle;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to fetch random puzzle';
            setError(errorMsg);
            console.error('Puzzle error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const validateMove = useCallback(async (moveUci) => {
        if (!puzzle) return false;

        const expectedMove = puzzle.solution[solutionIndex];
        const isCorrect = moveUci === expectedMove;

        if (isCorrect) {
            setSolutionIndex(prev => prev + 1);
        }

        return isCorrect;
    }, [puzzle, solutionIndex]);

    const resetPuzzle = useCallback(() => {
        setSolutionIndex(0);
    }, []);

    return {
        puzzle,
        loading,
        error,
        solutionIndex,
        fetchDailyPuzzle,
        fetchRandomPuzzle,
        validateMove,
        resetPuzzle
    };
};
