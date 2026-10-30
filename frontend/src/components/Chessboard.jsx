import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Wifi, WifiOff, RefreshCw, Share2, Copy, Check, RotateCcw, Zap, X } from 'lucide-react';
import { useChessGame } from '../hooks/useChessGame';
import { api } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

const TIME_CONTROLS = [
    { label: 'Bullet', value: '1+0', icon: '⚡' },
    { label: 'Blitz', value: '3+0', icon: '🚀' },
    { label: 'Rapid', value: '5+0', icon: '⏱️' },
    { label: 'Classic', value: '10+0', icon: '♟️' },
];

const ChessboardComponent = () => {
    const { user: authUser, isAuthenticated } = useAuth();
    const [gameId, setGameId] = useState(() => {
        // Get gameId from URL or generate new one
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('gameId') || Math.random().toString(36).substring(2, 10);
    });
    const [copied, setCopied] = useState(false);
    const { game, makeMove, resetGame, undoMove, isConnected } = useChessGame(gameId);
    const [moveFrom, setMoveFrom] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});

    // Quick Match state
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [matchTc, setMatchTc] = useState('3+0');
    const [matchStatus, setMatchStatus] = useState(null);
    const [matchPoll, setMatchPoll] = useState(null);

    const startMatchmaking = async () => {
        if (!authUser) return;
        setMatchStatus('queued');
        const res = await api.matchmaking.join(authUser.username, matchTc);
        if (res.status === 'paired') {
            setGameId(res.game_id);
            setMatchStatus('paired');
            setShowMatchModal(false);
        } else {
            // Poll for pairing
            const interval = setInterval(async () => {
                const s = await api.matchmaking.status(authUser.username);
                if (s.status === 'paired') {
                    clearInterval(interval);
                    setMatchPoll(null);
                    setGameId(s.game_id);
                    setMatchStatus('paired');
                    setShowMatchModal(false);
                }
            }, 2000);
            setMatchPoll(interval);
        }
    };

    const cancelMatchmaking = async () => {
        if (matchPoll) clearInterval(matchPoll);
        setMatchPoll(null);
        if (authUser) await api.matchmaking.leave(authUser.username);
        setMatchStatus(null);
        setShowMatchModal(false);
    };

    // Leave queue if component unmounts
    useEffect(() => {
        return () => {
            if (matchPoll) clearInterval(matchPoll);
        };
    }, [matchPoll]);

    // Update URL with gameId
    useEffect(() => {
        const url = new URL(window.location);
        url.searchParams.set('gameId', gameId);
        window.history.replaceState({}, '', url);
    }, [gameId]);

    const handleCopyLink = async () => {
        const shareUrl = `${window.location.origin}${window.location.pathname}?gameId=${gameId}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            alert(`Share this URL: ${shareUrl} `);
        }
    };

    const handleNewGame = () => {
        const newGameId = Math.random().toString(36).substring(2, 10);
        setGameId(newGameId);
        // Also reset the game state for the new game ID
        resetGame();
    };

    function onDrop(sourceSquare, targetSquare) {
        console.log('onDrop:', sourceSquare, targetSquare);
        const moveSuccessful = makeMove(sourceSquare, targetSquare);
        console.log('moveSuccessful:', moveSuccessful);
        if (moveSuccessful) {
            setOptionSquares({});
            setMoveFrom(null);
        }
        return moveSuccessful;
    }

    return (
        <div className="w-full max-w-6xl mx-auto p-4">
            {/* Connection Status Indicator */}
            <div className={`absolute top-0 right-0 p-2 rounded-full z-10 ${isConnected ? 'text-green-500' : 'text-red-500'}`} title={isConnected ? "Connected to Server" : "Disconnected"}>
                {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,75vh)_1fr] gap-6 items-start">
                {/* Board */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-[75vh] aspect-square shadow-2xl rounded-lg border-4 border-border">
                        <Chessboard
                            id="PlayBoard"
                            position={game.fen()}
                            onPieceDrop={onDrop}
                            arePiecesDraggable={true}
                            customDarkSquareStyle={{ backgroundColor: '#769656' }}
                            customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
                            animationDuration={200}
                        />
                    </div>

                    {/* Game Status */}
                    <div className="text-center space-y-1">
                        {game.isCheckmate() && (
                            <div className="text-2xl font-bold text-red-500">
                                Checkmate! {game.turn() === 'w' ? 'Black' : 'White'} wins!
                            </div>
                        )}
                        {game.isDraw() && (
                            <div className="text-2xl font-bold text-yellow-500">
                                Draw!
                            </div>
                        )}
                        {game.isCheck() && !game.isCheckmate() && (
                            <div className="text-xl font-bold text-orange-500">
                                Check!
                            </div>
                        )}
                        <div className="text-muted-foreground mt-2">
                            Turn: {game.turn() === 'w' ? 'White' : 'Black'}
                        </div>
                    </div>
                </div>

                {/* Info + Controls */}
                <div className="space-y-4">
                    <div className="bg-card rounded-xl p-5 shadow-xl border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                Multiplayer Game
                                {isConnected
                                    ? <Badge variant="secondary" className="gap-1"><Wifi size={12} className="text-green-500" />Online</Badge>
                                    : <Badge variant="destructive" className="gap-1"><WifiOff size={12} />Offline</Badge>}
                            </h3>
                        </div>
                        <div className="text-xs text-muted-foreground mb-4">
                            Game ID: <code className="bg-muted px-2 py-1 rounded">{gameId}</code>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={() => isAuthenticated ? setShowMatchModal(true) : alert('Login richiesto per il matchmaking')}
                                className="gap-2"
                                title="Quick Match"
                            >
                                <Zap size={16} />
                                Quick Match
                            </Button>
                            <Button
                                onClick={handleNewGame}
                                variant="secondary"
                                className="gap-2"
                                title="Start new game"
                            >
                                <RotateCcw size={16} />
                                New Game
                            </Button>
                            <Button
                                onClick={handleCopyLink}
                                variant="outline"
                                className="gap-2 text-primary"
                                title="Copy shareable link"
                            >
                                {copied ? <Check size={16} /> : <Share2 size={16} />}
                                {copied ? 'Copied!' : 'Share Game'}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-card rounded-xl p-5 shadow-xl border border-border space-y-2">
                        <div className="text-sm font-bold text-foreground mb-2">Controls</div>
                        <div className="flex flex-wrap gap-3">
                            <Button
                                onClick={resetGame}
                                variant="secondary"
                                className="gap-2"
                            >
                                <RefreshCw size={18} /> Reset Game
                            </Button>
                            <Button
                                onClick={undoMove}
                                variant="secondary"
                                className="gap-2"
                                title="Undo last move"
                            >
                                Undo Move
                            </Button>
                        </div>
                    </div>

                    {/* Quick Match Modal */}
                    {showMatchModal && (
                        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center p-4">
                            <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Zap size={18} className="text-primary" /> Quick Match
                                    </h3>
                                    <Button variant="ghost" size="icon" onClick={cancelMatchmaking} className="text-muted-foreground">
                                        <X size={18} />
                                    </Button>
                                </div>

                                <div className="text-sm text-muted-foreground mb-3">Scegli il tempo di gioco</div>
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {TIME_CONTROLS.map(tc => (
                                        <Button
                                            key={tc.value}
                                            onClick={() => setMatchTc(tc.value)}
                                            variant={matchTc === tc.value ? 'default' : 'secondary'}
                                            className="justify-center"
                                        >
                                            {tc.icon} {tc.label} ({tc.value})
                                        </Button>
                                    ))}
                                </div>

                                <Button
                                    onClick={startMatchmaking}
                                    disabled={matchStatus === 'queued'}
                                    className="w-full"
                                >
                                    {matchStatus === 'queued' ? 'In coda...' : 'Trova avversario'}
                                </Button>

                                {matchStatus === 'queued' && (
                                    <div className="mt-3 text-sm text-muted-foreground flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                        Cercando un avversario {matchTc}... (apri un altro tab con lo stesso tempo)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ChessboardComponent;
