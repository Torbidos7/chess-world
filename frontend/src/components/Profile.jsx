import React from 'react';
import { User, Award, TrendingUp, Clock, Calendar, Hash, Percent, Activity } from 'lucide-react';

const Profile = () => {
    // Mock data
    const user = {
        username: "ChessMaster2024",
        elo: 1542,
        joined: "Nov 2024",
        gamesPlayed: 142,
        wins: 78,
        losses: 52,
        draws: 12,
        recentGames: [
            { id: 1, opponent: "GrandMaster_B", result: "Win", date: "2 mins ago", eloChange: "+12" },
            { id: 2, opponent: "Rookie_99", result: "Loss", date: "1 hour ago", eloChange: "-8" },
            { id: 3, opponent: "Tactics_King", result: "Draw", date: "Yesterday", eloChange: "+1" },
        ]
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-4 text-chess-light">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-gray-700 pb-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-chess-accent to-purple-600 flex items-center justify-center text-4xl font-bold text-white shadow-2xl">
                        {user.username[0]}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-gray-900"></div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-1">
                    <h1 className="text-3xl font-bold text-white tracking-tight">{user.username}</h1>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-gray-400 font-medium text-sm">
                        <span className="flex items-center gap-2"><Calendar size={16} /> Joined {user.joined}</span>
                        <span className="flex items-center gap-2"><User size={16} /> Member</span>
                    </div>
                </div>

                <div className="text-center md:text-right">
                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Current Elo</div>
                    <div className="text-5xl font-mono font-bold text-chess-accent">{user.elo}</div>
                </div>
            </div>

            {/* Stats Section - Clean Layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                {/* Performance */}
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-green-400 border-b border-gray-800 pb-2">
                        <Award size={20} /> Performance
                    </h3>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Wins</span>
                        <span className="text-2xl font-bold text-white">{user.wins}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Losses</span>
                        <span className="text-2xl font-bold text-white">{user.losses}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Draws</span>
                        <span className="text-2xl font-bold text-white">{user.draws}</span>
                    </div>
                </div>

                {/* Statistics */}
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-blue-400 border-b border-gray-800 pb-2">
                        <TrendingUp size={20} /> Statistics
                    </h3>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Games Played</span>
                        <span className="text-2xl font-bold text-white">{user.gamesPlayed}</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <span className="text-gray-400 text-base">Win Rate</span>
                        <span className="text-2xl font-bold text-white">{((user.wins / user.gamesPlayed) * 100).toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden mt-4">
                        <div className="bg-blue-500 h-full" style={{ width: `${(user.wins / user.gamesPlayed) * 100}%` }}></div>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="space-y-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-purple-400 border-b border-gray-800 pb-2">
                        <Clock size={20} /> Recent Activity
                    </h3>
                    <div className="space-y-3">
                        {user.recentGames.map(game => (
                            <div key={game.id} className="flex items-center justify-between group text-sm">
                                <div className="flex flex-col">
                                    <span className="text-white font-medium group-hover:text-chess-accent transition-colors">vs {game.opponent}</span>
                                    <span className="text-xs text-gray-500">{game.date}</span>
                                </div>
                                <div className="text-right">
                                    <span className={`block font-bold ${game.result === 'Win' ? 'text-green-400' : game.result === 'Loss' ? 'text-red-400' : 'text-gray-400'}`}>
                                        {game.result}
                                    </span>
                                    <span className="text-xs text-gray-500">{game.eloChange}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
