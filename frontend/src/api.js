const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

let tokenInterceptor = null;

export function setToken(token) {
    tokenInterceptor = token;
}

export function clearToken() {
    tokenInterceptor = null;
}

export function getToken() {
    return tokenInterceptor;
}

async function request(path, options = {}) {
    const { method = 'GET', body, headers = {} } = options;

    if (tokenInterceptor) {
        headers['Authorization'] = `Bearer ${tokenInterceptor}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
    }

    return res.json();
}

export const api = {
    auth: {
        login: (username, password) =>
            request('/api/auth/login', { method: 'POST', body: { username, password } }),
        signup: (username, email, password) =>
            request('/api/auth/signup', { method: 'POST', body: { username, email, password } }),
    },
    users: {
        profile: (username) => request(`/api/users/${username}/profile`),
    },
    puzzles: {
        daily: () => request('/api/puzzles/daily'),
        random: () => request('/api/puzzles/random'),
        local: () => request('/api/puzzles/local'),
        validate: (fen, move) => request('/api/puzzles/validate', { method: 'POST', body: { fen, move } }),
    },
    engine: {
        evaluate: (fen) => request('/api/engine/evaluate', { method: 'POST', body: { fen } }),
        available: () => request('/api/engine/engines/available'),
    },
    pgn: {
        upload: (formData) => {
            const headers = tokenInterceptor ? { 'Authorization': `Bearer ${tokenInterceptor}` } : {};
            return fetch(`${BASE_URL}/api/pgn/upload`, {
                method: 'POST',
                headers,
                body: formData,
            }).then(r => r.json());
        },
        game: (sessionId, gameIndex) => request(`/api/pgn/game/${sessionId}/${gameIndex}`),
        navigate: (sessionId, gameIndex, moveIndex) =>
            request('/api/pgn/navigate', { method: 'POST', body: { session_id: sessionId, game_index: gameIndex, move_index: moveIndex } }),
    },
    llm: {
        chat: (prompt, fen, imageBase64) =>
            request('/api/llm/chat', { method: 'POST', body: { prompt, fen, image: imageBase64 } }),
        health: () => request('/api/llm/health'),
        models: () => request('/api/llm/models'),
    },
};
