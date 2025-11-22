import zstandard as zstd
import csv
import io
import random
from pathlib import Path
from typing import List, Dict, Optional

class PuzzleDatabase:
    def __init__(self, db_path: str = "docs/puzzles/lichess_db_puzzle.csv.zst"):
        self.db_path = Path(db_path)
        self.puzzles: List[Dict] = []
        self.loaded = False
    
    def load_puzzles(self, max_puzzles: int = 10000):
        """Load puzzles from compressed database"""
        if self.loaded:
            return
        
        if not self.db_path.exists():
            print(f"Puzzle database not found at {self.db_path}")
            return
        
        print(f"Loading puzzles from {self.db_path}...")
        
        try:
            # Decompress and read CSV
            with open(self.db_path, 'rb') as compressed:
                dctx = zstd.ZstdDecompressor()
                with dctx.stream_reader(compressed) as reader:
                    text_stream = io.TextIOWrapper(reader, encoding='utf-8')
                    csv_reader = csv.DictReader(text_stream)
                    
                    for i, row in enumerate(csv_reader):
                        if i >= max_puzzles:
                            break
                        
                        # Parse puzzle data
                        # Format: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
                        self.puzzles.append({
                            'id': row['PuzzleId'],
                            'fen': row['FEN'],
                            'moves': row['Moves'].split(),  # Space-separated UCI moves
                            'rating': int(row['Rating']),
                            'themes': row['Themes'].split(),
                            'popularity': int(row.get('Popularity', 0)),
                        })
            
            self.loaded = True
            print(f"Loaded {len(self.puzzles)} puzzles")
        
        except Exception as e:
            print(f"Error loading puzzle database: {e}")
    
    def get_random_puzzle(self, min_rating: Optional[int] = None, max_rating: Optional[int] = None) -> Optional[Dict]:
        """Get a random puzzle, optionally filtered by rating"""
        if not self.loaded:
            self.load_puzzles()
        
        if not self.puzzles:
            return None
        
        # Filter by rating if specified
        filtered = self.puzzles
        if min_rating or max_rating:
            filtered = [
                p for p in self.puzzles
                if (min_rating is None or p['rating'] >= min_rating) and
                   (max_rating is None or p['rating'] <= max_rating)
            ]
        
        if not filtered:
            filtered = self.puzzles
        
        puzzle = random.choice(filtered)
        
        # Format for frontend (first move is opponent's setup, rest is solution)
        moves = puzzle['moves']
        
        return {
            'id': puzzle['id'],
            'fen': puzzle['fen'],
            'rating': puzzle['rating'],
            'themes': puzzle['themes'],
            'solution': moves,  # All moves in UCI format
            'initial_move': ''  # FEN already has the position after opponent's move
        }

# Global instance
puzzle_db = PuzzleDatabase()
