import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Trophy, RefreshCw, AlertCircle, CheckCircle, XCircle, Zap } from 'lucide-react';
import { usePuzzle } from '../hooks/usePuzzle';

const Problems = () => {
    const [game, setGame] = useState(new Chess());
    const [status, setStatus] = useState('playing'); // 'playing', 'solved', 'failed'
    const [boardKey, setBoardKey] = useState(0); // Force board reset when puzzle changes

    const {
        puzzle,
        loading,
        error,
        solutionIndex,
        fetchDailyPuzzle,
        fetchRandomPuzzle,
        validateMove,
        resetPuzzle
    } = usePuzzle();

    // Load initial puzzle
    useEffect(() => {
        fetchDailyPuzzle();
    }, []);

    // Set up board when puzzle loads
    useEffect(() => {
        if (puzzle) {
            try {
                console.log('Loading puzzle:', puzzle);
                console.log('Puzzle FEN:', puzzle.fen);

                const newGame = new Chess(puzzle.fen);

                // If there's an initial move (opponent's move), play it
                if (puzzle.initial_move) {
                    console.log('Playing initial move:', puzzle.initial_move);
                    const initialFrom = puzzle.initial_move.substring(0, 2);
                    const initialTo = puzzle.initial_move.substring(2, 4);
                    const initialPromo = puzzle.initial_move.length > 4 ? puzzle.initial_move.substring(4, 5) : undefined;
                    const move = newGame.move({ from: initialFrom, to: initialTo, promotion: initialPromo });
                    if (!move) {
                        console.error('Failed to play initial move');
                    } else {
                        console.log('Initial move played:', move.san);
                    }
                }

                setGame(newGame);
                setStatus('playing');
                resetPuzzle();
                setBoardKey(prev => prev + 1); // Force board to reset with new puzzle
            } catch (error) {
                console.error("Error loading puzzle:", error);
                console.error("Puzzle data:", puzzle);
            }
        }
    }, [puzzle]);

    function onDrop(sourceSquare, targetSquare) {
        if (status !== 'playing' || !puzzle) return false;

        try {
            console.log('Puzzle Move:', sourceSquare, '->', targetSquare);
            const gameCopy = new Chess(game.fen());

            // Check for promotion
            const piece = gameCopy.get(sourceSquare);
            const isPromotion = piece?.type === 'p' && (
                (piece.color === 'w' && targetSquare[1] === '8') ||
                (piece.color === 'b' && targetSquare[1] === '1')
            );

            const move = gameCopy.move({
                from: sourceSquare,
                to: targetSquare,
                promotion: isPromotion ? 'q' : undefined,
            });

            if (!move) return false;

            // Convert to UCI for validation
            const uciMove = sourceSquare + targetSquare + (move.promotion ? move.promotion : '');

            // Validate against solution
            const isCorrect = validateMove(uciMove);

            if (isCorrect) {
                setGame(gameCopy);

                // Check if puzzle is complete
                if (solutionIndex >= puzzle.solution.length - 1) {
                    setStatus('solved');
                    return true;
                }

                // Play opponent's response (next move in solution)
                setTimeout(() => {
                    const responseMove = puzzle.solution[solutionIndex + 1];
                    if (responseMove) {
                        const responseFrom = responseMove.substring(0, 2);
                        const responseTo = responseMove.substring(2, 4);
                        const responseProm = responseMove.length > 4 ? responseMove.substring(4, 5) : undefined;

                        try {
                            setGame(current => {
                                const g = new Chess(current.fen());
                                g.move({ from: responseFrom, to: responseTo, promotion: responseProm });
                                return g;
                            });

                            // Check again if this was the last move
                            // We need to check against solution length - 2 because we just played one more move
                            if (solutionIndex + 2 >= puzzle.solution.length) {
                                setStatus('solved');
                            }
                        } catch (e) {
                            console.error("Error playing response:", e);
                        }
                    }
                }, 500);

                return true;
            } else {
                setStatus('failed');
                return false;
            }
        } catch (e) {
            return false;
        }
    }

    const handleNewPuzzle = () => {
        fetchDailyPuzzle();
    };

    const handleRetry = () => {
        if (puzzle) {
            // Reset to initial position
            const newGame = new Chess(puzzle.fen);
            if (puzzle.initial_move) {
                const initialFrom = puzzle.initial_move.substring(0, 2);
                const initialTo = puzzle.initial_move.substring(2, 4);
                const initialPromo = puzzle.initial_move.length > 4 ? puzzle.initial_move.substring(4, 5) : undefined;
                newGame.move({ from: initialFrom, to: initialTo, promotion: initialPromo });
            }
            setGame(newGame);
            setStatus('playing');
            resetPuzzle();
            setBoardKey(prev => prev + 1); // Force board reset
        }
    };

    return (
        <div className="flex flex-col items-center w-full max-w-6xl mx-auto p-4 gap-6">
            <div className="w-full flex flex-col items-center">
                <div className="w-full max-w-[75vh] aspect-square shadow-2xl rounded-lg border-4 border-gray-700 relative">
                    <Chessboard
                        key={boardKey}
                        id="ProblemBoard"
                        position={game.fen()}
                        onPieceDrop={onDrop}
                        boardOrientation={game.turn() === 'w' ? 'white' : 'black'}
                        customDarkSquareStyle={{ backgroundColor: '#769656' }}
                        customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
                        animationDuration={200}
                        arePiecesDraggable={status === 'playing'}
                    />

                    {/* Success Overlay */}
                    {status === 'solved' && (
                        <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in z-10">
                            <CheckCircle size={64} className="text-white mb-4" />
                            <h2 className="text-4xl font-bold text-white mb-4">Puzzle Solved!</h2>
                            <button
                                onClick={handleNewPuzzle}
                                className="mt-4 px-8 py-3 bg-white text-green-900 font-bold rounded-full hover:scale-105 transition-transform text-lg"
                            >
                                Next Puzzle
                            </button>
                        </div>
                    )}

                    {/* Failure Overlay */}
                    {status === 'failed' && (
                        <div className="absolute inset-0 bg-red-900/50 backdrop-blur-sm flex flex-col items-center justify-center animate-fade-in z-10">
                            <XCircle size={64} className="text-white mb-4" />
                            <h2 className="text-3xl font-bold text-white mb-4">Not Quite!</h2>
                            <p className="text-white mb-6">Try to find the best move</p>
                            <button
                                onClick={handleRetry}
                                className="px-8 py-3 bg-white text-red-900 font-bold rounded-full hover:scale-105 transition-transform"
                            >
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-gray-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-chess-accent mb-4"></div>
                            <p className="text-white text-lg">Loading puzzle...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Puzzle Info */}
            <div className="w-full max-w-[75vh] bg-gray-800 rounded-xl p-5 shadow-xl border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-chess-accent">
                        <Trophy className="text-yellow-400" size={22} /> Daily Puzzle
                    </h2>
                    <button
                        onClick={handleNewPuzzle}
                        disabled={loading}
                        className="px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg font-bold text-gray-200 transition-colors flex items-center gap-2"
                    >
                        <RefreshCw size={18} /> New Puzzle
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-2 text-sm">
                        <AlertCircle size={16} className="text-red-400" />
                        <span>{error}</span>
                    </div>
                )}

                {puzzle && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-700/50 rounded-lg">
                            <div className="text-xs text-gray-400 mb-1 uppercase tracking-wider font-bold">Difficulty</div>
                            <div className="flex items-center gap-2">
                                <Zap size={20} className={`${puzzle.rating > 2000 ? 'text-red-400' :
                                    puzzle.rating > 1500 ? 'text-yellow-400' :
                                        'text-green-400'
                                    }`} />
                                <div className="text-2xl font-bold text-white">
                                    {puzzle.rating}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-700/50 rounded-lg">
                            <div className="text-xs text-gray-400 mb-2 uppercase tracking-wider font-bold">Themes</div>
                            <div className="flex flex-wrap gap-1">
                                {puzzle.themes.slice(0, 6).map(theme => (
                                    <span key={theme} className="px-3 py-1 bg-gray-600 rounded-full text-xs text-gray-300 capitalize">
                                        {theme.replace(/([A-Z])/g, ' $1').trim()}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {puzzle && status === 'playing' && (
                    <div className="mt-4 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
                        <div className="text-sm text-blue-200">
                            <strong>Hint:</strong> Find the best move for {game.turn() === 'w' ? 'White' : 'Black'}
                        </div>
                        <div className="text-xs text-blue-300 mt-2">
                            Solution progress: {solutionIndex} / {puzzle.solution.length} moves
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Problems;
