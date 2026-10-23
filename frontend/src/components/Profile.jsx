import React, { useState, useEffect } from 'react';
import { User, Award, TrendingUp, Clock, Calendar, Percent, Activity } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';

const Profile = () => {
    const { user: authUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authUser) return;
        api.users.profile(authUser.username)
            .then(data => setProfile(data))
            .catch(() => setProfile(null))
            .finally(() => setLoading(false));
    }, [authUser]);

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto p-4 text-chess-light flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-chess-accent"></div>
            </div>
        );
    }

    const p = profile || {
        username: authUser?.username || 'Player',
        elo: 1200,
        games_played: 0,
        wins: 0,
        losses: 0,
        draws: 0,
    };

    const winRate = p.games_played > 0 ? ((p.wins / p.games_played) * 100).toFixed(1) : '0.0';
    const winPct = p.games_played > 0 ? (p.wins / p.games_played) * 100 : 0;

    return (
        <div className="w-full max-w-5xl mx-auto p-4 text-chess-light">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-gray-700 pb-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-chess-accent to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl">
                        {(p.username || 'U')[0]}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-gray-900"></div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{p.username}</h1>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-gray-400 font-medium text-sm">
                        <span className="flex items-center gap-2"><User size={16} /> Member</span>
                    </div>
                </div>

                <div className="text-center md:text-right">
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Current Elo</div>
                    <div className="text-5xl font-mono font-bold text-chess-accent">{p.elo}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-green-400 border-b border-gray-800 pb-2">
                        <Award size={20} /> Performance
                    </h3>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Wins</span>
                        <span className="text-2xl font-bold text-white">{p.wins}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Losses</span>
                        <span className="text-2xl font-bold text-white">{p.losses}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Draws</span>
                        <span className="text-2xl font-bold text-white">{p.draws}</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-blue-400 border-b border-gray-800 pb-2">
                        <TrendingUp size={20} /> Statistics
                    </h3>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Games Played</span>
                        <span className="text-2xl font-bold text-white">{p.games_played}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Win Rate</span>
                        <span className="text-2xl font-bold text-white">{winRate}%</span>
                    </div>
                    {p.games_played > 0 && (
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-4">
                            <div className="bg-blue-500 h-full" style={{ width: `${winPct}%` }}></div>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-purple-400 border-b border-gray-800 pb-2">
                        <Clock size={20} /> Recent Activity
                    </h3>
                    <div className="text-gray-500 text-sm italic">Game history coming soon</div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
