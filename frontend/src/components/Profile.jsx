import React, { useState, useEffect } from 'react';
import { User, Award, TrendingUp, Clock, Calendar, Percent, Activity, Users, Swords, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const Profile = () => {
    const { user: authUser } = useAuth();
    const [profile, setProfile] = useState(null);
    const [games, setGames] = useState([]);
    const [friends, setFriends] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [friendInput, setFriendInput] = useState('');
    const [friendMsg, setFriendMsg] = useState('');

    const loadData = () => {
        if (!authUser) return;
        api.users.profile(authUser.username)
            .then(data => setProfile(data))
            .catch(() => setProfile(null));
        api.users.games(authUser.username)
            .then(data => setGames(data.games || []))
            .catch(() => setGames([]));
        api.users.friends(authUser.username)
            .then(data => setFriends(data.friends || []))
            .catch(() => setFriends([]));
        api.users.friendRequests(authUser.username)
            .then(data => setRequests(data.requests || []))
            .catch(() => setRequests([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadData();
    }, [authUser]);

    const sendFriendRequest = async () => {
        if (!friendInput.trim()) return;
        try {
            await api.users.addFriend(authUser.username, friendInput.trim());
            setFriendMsg(`Richiesta inviata a ${friendInput.trim()}`);
            setFriendInput('');
            loadData();
        } catch (e) {
            setFriendMsg(e.message);
        }
    };

    const acceptRequest = async (from) => {
        try {
            await api.users.acceptFriend(authUser.username, from);
            setFriendMsg(`${from} è ora un tuo amico`);
            loadData();
        } catch (e) {
            setFriendMsg(e.message);
        }
    };

    const removeFriend = async (name) => {
        try {
            await api.users.removeFriend(authUser.username, name);
            setFriendMsg(`${name} rimosso dagli amici`);
            loadData();
        } catch (e) {
            setFriendMsg(e.message);
        }
    };

    const resultLabel = (game) => {
        if (game.result === '1-0') return game.white === authUser.username ? 'Vittoria' : 'Sconfitta';
        if (game.result === '0-1') return game.black === authUser.username ? 'Vittoria' : 'Sconfitta';
        if (game.result === '1/2-1/2') return 'Patta';
        return 'In corso';
    };

    if (loading) {
        return (
            <div className="w-full max-w-5xl mx-auto p-4 text-foreground flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
        <div className="w-full max-w-5xl mx-auto p-4 text-foreground">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-border pb-6">
                <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-4xl font-bold text-primary-foreground shadow-2xl">
                        {(p.username || 'U')[0]}
                    </div>
                    <div className="absolute bottom-1 right-1 bg-green-500 w-5 h-5 rounded-full border-4 border-background"></div>
                </div>

                <div className="flex-1 text-center md:text-left space-y-1">
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">{p.username}</h1>
                    <div className="flex items-center justify-center md:justify-start gap-4 text-muted-foreground font-medium text-sm">
                        <span className="flex items-center gap-2"><User size={16} /> Member</span>
                    </div>
                </div>

                <div className="text-center md:text-right">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Current Elo</div>
                    <div className="text-5xl font-mono font-bold text-primary">{p.elo}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 text-lg font-bold text-green-500 border-b border-border pb-2">
                        <Award size={20} /> Performance
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-muted-foreground text-base">Wins</span>
                            <span className="text-2xl font-bold text-foreground">{p.wins}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-muted-foreground text-base">Losses</span>
                            <span className="text-2xl font-bold text-foreground">{p.losses}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-muted-foreground text-base">Draws</span>
                            <span className="text-2xl font-bold text-foreground">{p.draws}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 text-lg font-bold text-blue-500 border-b border-border pb-2">
                        <TrendingUp size={20} /> Statistics
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-end">
                            <span className="text-muted-foreground text-base">Games Played</span>
                            <span className="text-2xl font-bold text-foreground">{p.games_played}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-muted-foreground text-base">Win Rate</span>
                            <span className="text-2xl font-bold text-foreground">{winRate}%</span>
                        </div>
                        {p.games_played > 0 && (
                            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden mt-4">
                                <div className="bg-blue-500 h-full" style={{ width: `${winPct}%` }}></div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 text-lg font-bold text-purple-500 border-b border-border pb-2">
                        <Clock size={20} /> Recent Activity
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {games.length === 0 ? (
                            <div className="text-muted-foreground text-sm italic">Nessuna partita ancora</div>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {games.map(g => (
                                    <div key={g.id} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                                        <span className="truncate text-foreground">
                                            {g.white} vs {g.black}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0 ml-3">
                                            <span className={`text-xs font-bold ${resultLabel(g) === 'Vittoria' ? 'text-green-500' : resultLabel(g) === 'Sconfitta' ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                {resultLabel(g)}
                                            </span>
                                            <span className="text-muted-foreground text-xs">{g.time_control}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 text-lg font-bold text-cyan-500 border-b border-border pb-2">
                        <Swords size={20} /> Game History
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {games.length === 0 ? (
                            <div className="text-muted-foreground text-sm italic">Nessuna partita giocata</div>
                        ) : (
                            <div className="space-y-2">
                                {games.map(g => (
                                    <div key={g.id} className="bg-muted rounded-lg px-3 py-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-foreground">{g.white} vs {g.black}</span>
                                            <span className="text-xs text-muted-foreground">{g.date ? new Date(g.date).toLocaleDateString() : ''}</span>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            Risultato: {g.result === '1-0' ? 'Bianco vince' : g.result === '0-1' ? 'Nero vince' : g.result === '1/2-1/2' ? 'Patta' : 'In corso'} · {g.time_control}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center gap-2 text-lg font-bold text-amber-500 border-b border-border pb-2">
                        <Users size={20} /> Friends
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                value={friendInput}
                                onChange={e => setFriendInput(e.target.value)}
                                placeholder="Aggiungi amico..."
                                className="flex-1"
                            />
                            <Button onClick={sendFriendRequest} className="gap-1">
                                <UserPlus size={14} /> Add
                            </Button>
                        </div>
                        {friendMsg && <div className="text-xs text-cyan-500">{friendMsg}</div>}

                        {requests.length > 0 && (
                            <div className="space-y-1">
                                <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Richieste in arrivo</div>
                                {requests.map(r => (
                                    <div key={r.from} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                                        <span className="text-foreground">{r.from}</span>
                                        <Button variant="secondary" size="sm" onClick={() => acceptRequest(r.from)} className="text-green-500 text-xs font-bold">Accept</Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="space-y-1">
                            <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Amici</div>
                            {friends.length === 0 ? (
                                <div className="text-muted-foreground text-sm italic">Nessun amico ancora</div>
                            ) : (
                                friends.map(f => (
                                    <div key={f.username} className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 text-sm">
                                        <span className="text-foreground">{f.username}</span>
                                        <Button variant="ghost" size="sm" onClick={() => removeFriend(f.username)} className="text-red-500 text-xs font-bold">Remove</Button>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Profile;
