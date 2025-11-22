import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useEngine = () => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [evaluation, setEvaluation] = useState(null);
    const [engineType, setEngineType] = useState('stockfish'); // 'stockfish' or 'chess-api'
    const [error, setError] = useState(null);

    const analyzePosition = useCallback(async (fen, depth = 20) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await axios.post(`${API_URL}/api/engine/evaluate`, {
                fen,
                depth,
                engine_type: engineType
            });

            setEvaluation(response.data);
            return response.data;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to analyze position';
            setError(errorMsg);
            console.error('Engine error:', err);
            return null;
        } finally {
            setIsAnalyzing(false);
        }
    }, [engineType]);

    const toggleEngine = useCallback(() => {
        setEngineType(prev => prev === 'stockfish' ? 'chess-api' : 'stockfish');
        setEvaluation(null); // Clear previous evaluation
    }, []);

    const checkEnginesAvailable = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/engine/engines/available`);
            return response.data;
        } catch (err) {
            console.error('Failed to check engines:', err);
            return null;
        }
    }, []);

    return {
        isAnalyzing,
        evaluation,
        engineType,
        error,
        analyzePosition,
        toggleEngine,
        checkEnginesAvailable
    };
};
