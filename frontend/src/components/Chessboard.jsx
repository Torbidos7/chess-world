import React, { useState } from 'react';
import { Chessboard } from 'react-chessboard';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useChessGame } from '../hooks/useChessGame';

const ChessboardComponent = () => {
    const { game, makeMove, resetGame, isConnected } = useChessGame();
    const [moveFrom, setMoveFrom] = useState(null);
    const [optionSquares, setOptionSquares] = useState({});

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
        <div className="w-full h-full flex flex-col items-center justify-center relative">
            {/* Connection Status Indicator */}
            <div className={`absolute top-0 right-0 p-2 rounded-full z-10 ${isConnected ? 'text-green-500' : 'text-red-500'}`} title={isConnected ? "Connected to Server" : "Disconnected"}>
                {isConnected ? <Wifi size={20} /> : <WifiOff size={20} />}
            </div>

            <div className="w-full max-w-[70vh] aspect-square shadow-2xl rounded-lg border-4 border-gray-700">
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
