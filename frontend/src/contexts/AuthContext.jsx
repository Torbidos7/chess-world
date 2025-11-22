import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check localStorage for existing session
        const savedUser = localStorage.getItem('chess_user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const login = (username, password) => {
        // Simple demo login - in production, call backend API
        const userData = {
            username,
            email: `${username}@chess.world`,
            elo: 1200,
            joined: new Date().toISOString()
        };
        setUser(userData);
        localStorage.setItem('chess_user', JSON.stringify(userData));
        return Promise.resolve(userData);
    };

    const signup = (username, email, password) => {
        // Simple demo signup
        const userData = {
            username,
            email,
            elo: 1200,
            joined: new Date().toISOString()
        };
        setUser(userData);
        localStorage.setItem('chess_user', JSON.stringify(userData));
        return Promise.resolve(userData);
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('chess_user');
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
