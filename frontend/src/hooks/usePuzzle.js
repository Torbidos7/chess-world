import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const usePuzzle = () => {
    const [puzzle, setPuzzle] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [solutionIndex, setSolutionIndex] = useState(0);
    const [source, setSource] = useState('api'); // 'api' or 'local'

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

    const fetchRandomPuzzle = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const endpointPath = source === 'local' ? '/api/puzzles/local' : '/api/puzzles/random';
            const response = await axios.get(`${API_URL}${endpointPath}`);
            setPuzzle(response.data.puzzle);
            setSolutionIndex(0);
        } catch (err) {
            console.error('Failed to fetch puzzle:', err);
            setError(err.message || 'Failed to load puzzle');
        } finally {
            setLoading(false);
        }
    }, [source]);

    const validateMove = useCallback((moveUci) => {
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
        source,
        setSource,
        fetchDailyPuzzle,
        fetchRandomPuzzle,
        validateMove,
        resetPuzzle,
    };
};
