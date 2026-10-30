import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { Brain, RefreshCw, Play, AlertCircle, Upload, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEngine } from '../hooks/useEngine';
import { useTraining } from '../hooks/useTraining';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

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
        try {
            console.log('Attempting move:', sourceSquare, '->', targetSquare);
            console.log('Current FEN:', game.fen());
            console.log('Current Turn:', game.turn());

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

            if (move) {
                setGame(gameCopy);
                return true;
            }
        } catch (error) {
            console.error('Invalid move error:', error);
            return false;
        }
        return false;
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
        <div className="w-full max-w-6xl mx-auto p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,75vh)_1fr] gap-6 items-start">
                {/* Board + Controls + PGN Nav */}
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-[75vh] aspect-square shadow-2xl rounded-lg border-4 border-border">
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

                    <div className="flex flex-wrap justify-center gap-3">
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setGame(new Chess());
                                setBoardKey(prev => prev + 1);
                            }}
                            className="gap-2"
                        >
                            <RefreshCw size={16} /> Reset
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => safeGameMutate((game) => game.undo())}
                        >
                            Undo
                        </Button>
                        <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-medium text-sm transition-colors cursor-pointer">
                            <Upload size={16} />
                            <input type="file" accept=".pgn" onChange={handlePgnUpload} className="hidden" />
                            {pgnLoading ? 'Loading...' : 'Load PGN'}
                        </label>
                    </div>

                    {currentGame && (
                        <div className="w-full max-w-[75vh] bg-card rounded-lg p-4 border border-border">
                            <div className="flex items-center justify-between mb-3">
                                <div className="text-sm">
                                    <div className="font-bold text-foreground">{currentGame.headers.White} vs {currentGame.headers.Black}</div>
                                    <div className="text-muted-foreground text-xs">{currentGame.headers.Event} • {currentGame.headers.Date}</div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Move {currentMoveIndex} / {currentGame.moves.length}
                                </div>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <Button variant="secondary" size="icon" onClick={() => { const fen = firstMove(); if (fen) setGame(new Chess(fen)); }} title="First move">
                                    <ChevronsLeft size={18} />
                                </Button>
                                <Button variant="secondary" size="icon" onClick={() => { const fen = previousMove(); if (fen) setGame(new Chess(fen)); }} title="Previous">
                                    <ChevronLeft size={18} />
                                </Button>
                                <Button variant="secondary" size="icon" onClick={() => { const fen = nextMove(); if (fen) setGame(new Chess(fen)); }} title="Next">
                                    <ChevronRight size={18} />
                                </Button>
                                <Button variant="secondary" size="icon" onClick={() => { const fen = lastMove(); if (fen) setGame(new Chess(fen)); }} title="Last move">
                                    <ChevronsRight size={18} />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Analysis + Game Selection */}
                <div className="space-y-4">
                    <Card>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                                    <Brain className="text-purple-500" size={22} /> Engine Analysis
                                </h2>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={toggleEngine}
                                        className="gap-2"
                                        title="Toggle between engines"
                                    >
                                        {engineType === 'stockfish' ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                        {engineType === 'stockfish' ? 'Stockfish' : 'chess-api'}
                                    </Button>
                                    <Button
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing}
                                        className="gap-2"
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Analyze'}
                                    </Button>
                                </div>
                            </div>

                            {engineError && (
                                <div className="mb-4 p-3 bg-destructive/10 border border-destructive rounded-lg flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle size={16} />
                                    <span>{engineError}</span>
                                </div>
                            )}

                            <div className="space-y-4">
                                {!evaluation && !isAnalyzing && (
                                    <div className="text-center text-muted-foreground py-6 text-base">
                                        <p>Make a move or click Analyze to get engine evaluation.</p>
                                        <p className="text-sm mt-2">Current engine: <span className="font-bold text-primary">{engineType}</span></p>
                                    </div>
                                )}

                                {isAnalyzing && (
                                    <div className="flex flex-col items-center justify-center py-6 space-y-3">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                        <p className="text-foreground">Calculating best move...</p>
                                    </div>
                                )}

                                {evaluation && (
                                    <div className="animate-fade-in">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div className={`p-4 rounded-lg border flex flex-col justify-center ${evaluation.eval_score > 0 ? 'bg-green-900/30 border-green-700' : 'bg-red-900/30 border-red-700'}`}>
                                                <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">Evaluation</div>
                                                <div className="text-3xl font-mono font-bold text-foreground">
                                                    {evaluation.mate_in ? `M${evaluation.mate_in}` : `${evaluation.eval_score > 0 ? '+' : ''}${evaluation.eval_score.toFixed(2)}`}
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">Win chance: {evaluation.win_chance?.toFixed(1)}%</div>
                                            </div>

                                            <div className="p-4 bg-muted rounded-lg border border-border">
                                                <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-2">Best Move</div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl font-bold text-foreground">{evaluation.best_move_san}</span>
                                                    <Button
                                                        onClick={playBestMove}
                                                        size="sm"
                                                        className="gap-1 bg-purple-600 text-white hover:bg-purple-500"
                                                    >
                                                        <Play size={16} /> Play it
                                                    </Button>
                                                </div>
                                                {evaluation.principal_variation && evaluation.principal_variation.length > 0 && (
                                                    <div className="mt-3 text-sm text-muted-foreground">
                                                        <span className="font-semibold text-foreground">Line: </span>
                                                        {evaluation.principal_variation.slice(0, 5).join(' ')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {evaluation.alternative_moves && evaluation.alternative_moves.length > 0 && (
                                            <div className="p-4 bg-muted rounded-lg border border-border">
                                                <div className="text-sm font-bold text-foreground mb-3">Alternative Moves (Stockfish Multipv)</div>
                                                <div className="space-y-2">
                                                    {evaluation.alternative_moves.map((altMove, idx) => (
                                                        <div key={idx} className="flex items-center justify-between p-2 bg-card rounded text-sm">
                                                            <span className="font-mono font-bold text-foreground">{idx + 2}. {altMove.move_san}</span>
                                                            <span className={`font-mono ${altMove.eval_score > 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                        </CardContent>
                    </Card>

                    {games.length > 0 && (
                        <Card>
                            <CardContent className="p-4">
                                <div className="text-sm font-bold text-foreground mb-3">Games in PGN ({games.length})</div>
                                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                                    {games.map((g) => (
                                        <Button
                                            key={g.index}
                                            variant={currentGame?.game_index === g.index ? 'default' : 'secondary'}
                                            onClick={() => loadGame(g.index)}
                                            className="p-3 justify-start text-left text-sm w-full"
                                        >
                                            <span className="font-medium">{g.white} vs {g.black}</span>
                                            <span className="text-xs opacity-75">{g.event} • {g.result}</span>
                                        </Button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Training;
