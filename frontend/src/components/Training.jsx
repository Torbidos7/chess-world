import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Brain, RefreshCw, Play, AlertCircle, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEngine } from '../hooks/useEngine';
import { useTraining } from '../hooks/useTraining';

const Training = () => {
    const [game, setGame] = useState(new Chess());
    const [boardKey, setBoardKey] = useState(0); // To force board reset when needed

    // Use new hooks
    const {
        isAnalyzing,
        evaluation,
        engineType,
        error: engineError,
        analyzePosition,
        toggleEngine
    } = useEngine();

    const {
        sessionId,
        games,
        currentGame,
        currentMoveIndex,
        loading: pgnLoading,
        error: pgnError,
        uploadPGN,
        loadGame,
        nextMove,
        previousMove,
        firstMove,
        lastMove,
        getCurrentFEN
    } = useTraining();

    // Update board when navigating through PGN
    useEffect(() => {
        const fen = getCurrentFEN();
        if (fen) {
            setGame(new Chess(fen));
            // We don't strictly need to update boardKey here if position prop handles it, 
            // but if it gets stuck, we can increment it.
        }
    }, [currentMoveIndex, getCurrentFEN]);

    function safeGameMutate(modify) {
        setGame((g) => {
            const update = new Chess(g.fen());
            modify(update);
            return update;
        });
    }

    function onDrop(sourceSquare, targetSquare) {
        let move = null;
        safeGameMutate((game) => {
            try {
                move = game.move({
                    from: sourceSquare,
                    to: targetSquare,
                    promotion: 'q',
                });
            } catch (error) {
                console.error('Invalid move:', error);
                return game; // Return unchanged game
            }
            return game;
        });
        return move !== null;
    }

    const handlePgnUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const result = await uploadPGN(file);
            if (result && result.games.length > 0) {
                // Load first game by default
                await loadGame(0);
                setBoardKey(prev => prev + 1);
            }
        }
    };

    const handleAnalyze = async () => {
        await analyzePosition(game.fen());
    };

    const playBestMove = () => {
        if (!evaluation || !evaluation.best_move_uci) return;

        safeGameMutate((g) => {
            try {
                const uci = evaluation.best_move_uci;
                const from = uci.substring(0, 2);
                const to = uci.substring(2, 4);
                const promotion = uci.length > 4 ? uci.substring(4, 5) : undefined;

                const move = g.move({ from, to, promotion });
                if (!move) {
                    console.error("Invalid move:", { from, to, promotion });
                }
            } catch (e) {
                console.error("Move error:", e);
            }
        });
    };

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 gap-6">
            {/* Board Section */}
            <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-[75vh] aspect-square shadow-2xl rounded-lg overflow-hidden border-4 border-gray-700">
                    <Chessboard
                        key={boardKey}
                        id="TrainingBoard"
                        position={game.fen()}
                        onPieceDrop={onDrop}
                        customDarkSquareStyle={{ backgroundColor: '#769656' }}
                        customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
                        animationDuration={200}
                    />
                </div>

                {/* Controls */}
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                    <button
                        onClick={() => {
                            setGame(new Chess());
                            setBoardKey(prev => prev + 1);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
                    >
                        <RefreshCw size={16} /> Reset
                    </button>
                    <button
                        onClick={() => safeGameMutate((game) => game.undo())}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium text-sm transition-colors"
                    >
                        Undo
                    </button>
                    <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium text-sm transition-colors cursor-pointer">
                        <Upload size={16} />
                        <input type="file" accept=".pgn" onChange={handlePgnUpload} className="hidden" />
                        {pgnLoading ? 'Loading...' : 'Load PGN'}
                    </label>
                </div>

                {/* PGN Navigation */}
                {currentGame && (
                    <div className="mt-4 w-full max-w-[75vh] bg-gray-800 rounded-lg p-4 border border-gray-700">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm">
                                <div className="font-bold text-white">{currentGame.headers.White} vs {currentGame.headers.Black}</div>
                                <div className="text-gray-400 text-xs">{currentGame.headers.Event} • {currentGame.headers.Date}</div>
                            </div>
                            <div className="text-xs text-gray-400">
                                Move {currentMoveIndex} / {currentGame.moves.length}
                            </div>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <button onClick={() => { const fen = firstMove(); if (fen) setGame(new Chess(fen)); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="First move">
                                <ChevronsLeft size={18} />
                            </button>
                            <button onClick={() => { const fen = previousMove(); if (fen) setGame(new Chess(fen)); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Previous">
                                <ChevronLeft size={18} />
                            </button>
                            <button onClick={() => { const fen = nextMove(); if (fen) setGame(new Chess(fen)); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Next">
                                <ChevronRight size={18} />
                            </button>
                            <button onClick={() => { const fen = lastMove(); if (fen) setGame(new Chess(fen)); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded" title="Last move">
                                <ChevronsRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Analysis Section */}
            <div className="w-full max-w-[75vh] bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-chess-accent">
                        <Brain className="text-purple-400" size={22} /> Engine Analysis
                    </h2>
                    <div className="flex items-center gap-3">
                        {/* Engine Toggle */}
                        <button
                            onClick={toggleEngine}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors"
                            title="Toggle between engines"
                        >
                            {engineType === 'stockfish' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                            {engineType === 'stockfish' ? 'Stockfish' : 'chess-api'}
                        </button>
                        <button
                            onClick={handleAnalyze}
                            disabled={isAnalyzing}
                            className="px-5 py-2 bg-chess-accent hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold shadow-lg shadow-blue-900/20 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                        </button>
                    </div>
                </div>

                {engineError && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-sm">
                        <AlertCircle size={16} className="text-red-400" />
                        <span>{engineError}</span>
                    </div>
                )}

                <div className="space-y-4">
                    {!evaluation && !isAnalyzing && (
                        <div className="text-center text-gray-400 py-6 text-base">
                            <p>Make a move or click Analyze to get engine evaluation.</p>
                            <p className="text-sm mt-2">Current engine: <span className="font-bold text-chess-accent">{engineType}</span></p>
                        </div>
                    )}

                    {isAnalyzing && (
                        <div className="flex flex-col items-center justify-center py-6 space-y-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-chess-accent"></div>
                            <p className="text-gray-300">Calculating best move...</p>
                        </div>
                    )}

                    {evaluation && (
                        <div className="animate-fade-in">
                            {/* Primary Evaluation */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div className={`p-4 rounded-lg border flex flex-col justify-center ${evaluation.eval_score > 0 ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
                                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-1">Evaluation</div>
                                    <div className="text-3xl font-mono font-bold">
                                        {evaluation.mate_in ? `M${evaluation.mate_in}` : `${evaluation.eval_score > 0 ? '+' : ''}${evaluation.eval_score.toFixed(2)}`}
                                    </div>
                                    <div className="text-sm text-gray-300 mt-1">Win chance: {evaluation.win_chance?.toFixed(1)}%</div>
                                </div>

                                <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                                    <div className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-2">Best Move</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl font-bold text-white">{evaluation.best_move_san}</span>
                                        <button
                                            onClick={playBestMove}
                                            className="flex items-center gap-1 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Play size={16} /> Play it
                                        </button>
                                    </div>
                                    {evaluation.principal_variation && evaluation.principal_variation.length > 0 && (
                                        <div className="mt-3 text-sm text-gray-400">
                                            <span className="font-semibold text-gray-500">Line: </span>
                                            {evaluation.principal_variation.slice(0, 5).join(' ')}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Alternative Moves (Stockfish only) */}
                            {evaluation.alternative_moves && evaluation.alternative_moves.length > 0 && (
                                <div className="p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                                    <div className="text-sm font-bold text-gray-300 mb-3">Alternative Moves (Stockfish Multipv)</div>
                                    <div className="space-y-2">
                                        {evaluation.alternative_moves.map((altMove, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-800/50 rounded text-sm">
                                                <span className="font-mono font-bold text-white">{idx + 2}. {altMove.move_san}</span>
                                                <span className={`font-mono ${altMove.eval_score > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {altMove.mate_in ? `M${altMove.mate_in}` : `${altMove.eval_score > 0 ? '+' : ''}${altMove.eval_score.toFixed(2)}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Game Selection (if PGN loaded) */}
            {games.length > 0 && (
                <div className="w-full max-w-[75vh] bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="text-sm font-bold text-gray-300 mb-3">Games in PGN ({games.length})</div>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                        {games.map((g) => (
                            <button
                                key={g.index}
                                onClick={() => loadGame(g.index)}
                                className={`p-3 rounded-lg text-left text-sm transition-colors ${currentGame?.game_index === g.index
                                        ? 'bg-chess-accent text-white'
                                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                                    }`}
                            >
                                <div className="font-medium">{g.white} vs {g.black}</div>
                                <div className="text-xs opacity-75">{g.event} • {g.result}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Training;
