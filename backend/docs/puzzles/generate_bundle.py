"""Genera un mini bundle di puzzle tattici offline (mate-in-1) e lo salva come JSON.

Bundle locale: nessuna dipendenza esterna, funziona anche in produzione (Render).
"""
import chess
import random
import json
from pathlib import Path

OUT = Path("docs/puzzles/puzzles.json")

def random_safe_square(board, color):
    """Piazza il re su una casa senza pedine e senza scacco immediato."""
    for _ in range(500):
        sq = random.randrange(64)
        if board.piece_at(sq) is None:
            return chess.Square(sq)
    return None

def random_position(n_white, n_black):
    """Posizione legale casuale con re + n pezzi per lato."""
    for _ in range(3000):
        board = chess.Board(None)
        board.clear()
        w_king = random_safe_square(board, chess.WHITE)
        b_king = random_safe_square(board, chess.BLACK)
        if w_king is None or b_king is None or w_king == b_king:
            continue
        board.set_piece_at(w_king, chess.Piece(chess.KING, chess.WHITE))
        board.set_piece_at(b_king, chess.Piece(chess.KING, chess.BLACK))
        placed_w = 1
        placed_b = 1
        for _ in range(300):
            if placed_w >= n_white and placed_b >= n_black:
                break
            color = chess.WHITE if placed_w < n_white else chess.BLACK
            if placed_w >= n_white and placed_b >= n_black:
                break
            pt = random.choice([chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT, chess.PAWN])
            sq = random_safe_square(board, color)
            if sq is None:
                continue
            if board.piece_at(sq) is not None:
                continue
            board.set_piece_at(sq, chess.Piece(pt, color))
            if color == chess.WHITE:
                placed_w += 1
            else:
                placed_b += 1
        if placed_w < n_white or placed_b < n_black:
            continue
        if board.is_valid() and not board.is_game_over(claim_draw=True):
            return board
    return None

def find_mate_in_one(board):
    for move in board.legal_moves:
        board.push(move)
        if board.is_checkmate():
            board.pop()
            return move
        board.pop()
    return None

def rating_heuristic(board):
    material = 0
    for sq, pc in board.piece_map().items():
        v = {'Q': 9, 'R': 5, 'B': 3, 'N': 3, 'P': 1}.get(pc.symbol().upper(), 0)
        material += v
    return 1100 + material * 10

def main():
    puzzles = []
    seen = set()
    attempts = 0
    while len(puzzles) < 40 and attempts < 5000:
        attempts += 1
        board = random_position(random.choice([5, 6]), random.choice([5, 6]))
        if board is None:
            continue
        move = find_mate_in_one(board)
        if move is None:
            continue
        fen = board.fen()
        if fen in seen:
            continue
        seen.add(fen)
        puzzles.append({
            "id": f"local-{len(puzzles)+1}",
            "fen": fen,
            "rating": rating_heuristic(board),
            "themes": ["mateIn1", "checkmate"],
            "solution": [move.uci()],
            "initial_move": "",
        })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(puzzles, indent=2))
    print(f"Generati {len(puzzles)} puzzle in {OUT}")

if __name__ == "__main__":
    main()
