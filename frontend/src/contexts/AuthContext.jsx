import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const saved = localStorage.getItem('chess_auth');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setToken(parsed.token);
                setUser(parsed.user);
            } catch {
                localStorage.removeItem('chess_auth');
            }
        }
        setLoading(false);
    }, []);

    const saveSession = (token, userData) => {
        setToken(token);
        setUser(userData);
        localStorage.setItem('chess_auth', JSON.stringify({ token, user: userData }));
    };

    const login = async (username, password) => {
        const res = await api.auth.login(username, password);
        saveSession(res.access_token, res.user);
        return res.user;
    };

    const signup = async (username, email, password) => {
        const res = await api.auth.signup(username, email, password);
        saveSession(res.access_token, res.user);
        return res.user;
    };

    const logout = () => {
        clearToken();
        setUser(null);
        localStorage.removeItem('chess_auth');
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};
