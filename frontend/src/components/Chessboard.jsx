import React, { useState, useEffect } from 'react';
import { Chessboard } from 'react-chessboard';
import { Wifi, WifiOff, RefreshCw, Share2, Copy, Check, RotateCcw } from 'lucide-react';
import { useChessGame } from '../hooks/useChessGame';

const ChessboardComponent = () => {
    const [gameId, setGameId] = useState(() => {
        // Get gameId from URL or generate new one
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('gameId') || Math.random().toString(36).substring(2, 10);
    });
    const [copied, setCopied] = useState(false);
    const { game, makeMove, resetGame, isConnected } = useChessGame(gameId);
    const [moveFrom, setMoveFrom] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});

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
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 gap-4">
            {/* Connection Status Indicator */}
            <div className={`absolute top - 0 right - 0 p - 2 rounded - full z - 10 ${isConnected ? 'text-green-500' : 'text-red-500'} `} title={isConnected ? "Connected to Server" : "Disconnected"}>
                {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>

            <div className="w-full max-w-[75vh] bg-gray-800 rounded-xl p-4 shadow-xl border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white">Multiplayer Game</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleNewGame}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                            title="Start new game"
                        >
                            <RotateCcw size={16} />
                            New Game
                        </button>
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
                            title="Copy shareable link"
                        >
                            {copied ? <Check size={16} /> : <Share2 size={16} />}
                            {copied ? 'Copied!' : 'Share Game'}
                        </button>
                    </div>
                </div>
                <div className="text-xs text-gray-400">
                    Game ID: <code className="bg-gray-900 px-2 py-1 rounded">{gameId}</code>
                </div>
            </div>

            <div className="w-full max-w-[75vh] aspect-square shadow-2xl rounded-lg border-4 border-gray-700">
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

            {/* Controls */}
            <div className="mt-6 flex gap-3">
                <button
                    onClick={resetGame}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
                >
                    <RefreshCw size={18} /> Reset Game
                </button>
                <button
                    onClick={() => {
                        // Undo is handled by game state update from backend usually, 
                        // but for local optimistic update we might need a specific handler if not implemented in hook
                        // For now, we rely on the hook's game state.
                        // If useChessGame doesn't expose undo, we might need to add it or just rely on reset.
                        // Let's just keep Reset for now to be safe.
                    }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
                >
                    Undo Move
                </button>
            </div>

            {/* Game Status */}
            <div className="mt-4 text-center">
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
                <div className="text-gray-400 mt-2">
                    Turn: {game.turn() === 'w' ? 'White' : 'Black'}
                </div>
            </div>
        </div>
    );
};

export default ChessboardComponent;
