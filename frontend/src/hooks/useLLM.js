import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useLLM = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: 'Welcome to Chess World! I can help you analyze positions, explain moves, and answer chess questions. You can send me a screenshot of the board for visual analysis!'
        }
    ]);

    const sendMessage = useCallback(async (prompt, fen = null, imageBase64 = null, context = null) => {
        const userMessage = {
            role: 'user',
            content: prompt,
            image: imageBase64 ? true : false
        };

        setMessages(prev => [...prev, userMessage]);
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post(`${API_URL}/api/llm/chat`, {
                prompt,
                fen,
                image_base64: imageBase64,
                context
            });

            const assistantMessage = {
                role: 'assistant',
                content: response.data.response,
                suggested_moves: response.data.suggested_moves
            };

            setMessages(prev => [...prev, assistantMessage]);
            return response.data;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || 'Failed to get LLM response';
            setError(errorMsg);

            const errorMessage = {
                role: 'assistant',
                content: `Error: ${errorMsg}. Make sure Ollama is running: \`ollama serve\``,
                isError: true
            };

            setMessages(prev => [...prev, errorMessage]);
            console.error('LLM error:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const checkHealth = useCallback(async () => {
        try {
            const response = await axios.get(`${API_URL}/api/llm/health`);
            return response.data;
        } catch (err) {
            console.error('LLM health check failed:', err);
            return { status: 'unhealthy', ollama_running: false };
        }
    }, []);

    const clearMessages = useCallback(() => {
        setMessages([{
            role: 'assistant',
            content: 'Chat cleared. How can I help you with chess?'
        }]);
    }, []);

    return {
        loading,
        error,
        messages,
        sendMessage,
        checkHealth,
        clearMessages
    };
};
