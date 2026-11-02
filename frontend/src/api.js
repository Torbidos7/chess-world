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

export function wakeBackend() {
    // Risveglia il backend su Render (sleep dopo 30 min di inattività).
    // Solo in produzione (VITE_API_URL https), fire-and-forget, non blocca l'avvio.
    if (!BASE_URL.startsWith('https')) return;
    fetch(`${BASE_URL}/health`, { method: 'GET' }).catch(() => {});
}

export const api = {
    system: {
        health: () => request('/health'),
    },
    auth: {
        login: (username, password) =>
            request('/api/auth/login', { method: 'POST', body: { username, password } }),
        signup: (username, email, password) =>
            request('/api/auth/signup', { method: 'POST', body: { username, email, password } }),
    },
    users: {
        profile: (username) => request(`/api/users/${username}/profile`),
        games: (username) => request(`/api/users/${username}/games`),
        friends: (username) => request(`/api/users/${username}/friends`),
        friendRequests: (username) => request(`/api/users/${username}/friends/requests`),
        addFriend: (username, friendUsername) =>
            request(`/api/users/${username}/friends/add`, { method: 'POST', body: { friend_username: friendUsername } }),
        acceptFriend: (username, friendUsername) =>
            request(`/api/users/${username}/friends/accept?friend_username=${friendUsername}`, { method: 'POST' }),
        removeFriend: (username, friendUsername) =>
            request(`/api/users/${username}/friends/remove?friend_username=${friendUsername}`, { method: 'DELETE' }),
        invites: {
            send: (username, receiver, timeControl) =>
                request(`/api/users/${username}/invite`, { method: 'POST', body: { receiver, time_control: timeControl } }),
            pending: (username) => request(`/api/users/${username}/invites/pending`),
            accept: (username, inviteId) =>
                request(`/api/users/${username}/invites/${inviteId}/accept`, { method: 'POST' }),
            decline: (username, inviteId) =>
                request(`/api/users/${username}/invites/${inviteId}/decline`, { method: 'POST' }),
            status: (username, inviteId) =>
                request(`/api/users/${username}/invites/${inviteId}/status`, { method: 'POST' }),
        },
    },
    puzzles: {
        daily: () => request('/api/puzzles/daily'),
        random: (params = '') => request(`/api/puzzles/random${params}`),
        local: () => request('/api/puzzles/local'),
        validate: (puzzle_id, move_uci, solution_index) =>
            request('/api/puzzles/validate', { method: 'POST', body: { puzzle_id, move_uci, solution_index } }),
    },
    engine: {
        evaluate: (fen) => request('/api/engine/evaluate', { method: 'POST', body: { fen } }),
        available: () => request('/api/engine/engines/available'),
    },
    matchmaking: {
        join: (username, timeControl) =>
            request('/api/matchmaking/queue', { method: 'POST', body: { username, time_control: timeControl } }),
        status: (username) => request(`/api/matchmaking/status?username=${username}`),
        leave: (username) => request(`/api/matchmaking/leave?username=${username}`, { method: 'DELETE' }),
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
