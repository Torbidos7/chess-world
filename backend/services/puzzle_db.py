"""Database puzzle locale: carica un bundle JSON di puzzle offline.

Nessuna dipendenza esterna (non serve il csv da 500MB): funziona anche in
produzione su Render. Il bundle è generato da docs/puzzles/generate_bundle.py.
"""
import json
import random
from pathlib import Path
from typing import List, Dict, Optional

BUNDLE_PATH = Path(__file__).resolve().parent.parent / "docs/puzzles/puzzles.json"

class PuzzleDatabase:
    def __init__(self, db_path: str = str(BUNDLE_PATH)):
        self.db_path = Path(db_path)
        self.puzzles: List[Dict] = []

    def load_puzzles(self):
        if self.puzzles:
            return
        if not self.db_path.exists():
            print(f"Puzzle bundle not found at {self.db_path}")
            return
        try:
            with open(self.db_path, 'r', encoding='utf-8') as f:
                self.puzzles = json.load(f)
            print(f"Loaded {len(self.puzzles)} puzzles from {self.db_path}")
        except Exception as e:
            print(f"Error loading puzzle bundle: {e}")

    def get_random_puzzle(
        self,
        min_rating: Optional[int] = None,
        max_rating: Optional[int] = None,
        theme: Optional[str] = None,
    ) -> Optional[Dict]:
        self.load_puzzles()
        if not self.puzzles:
            return None

        filtered = self.puzzles
        if min_rating is not None or max_rating is not None:
            filtered = [
                p for p in self.puzzles
                if (min_rating is None or p['rating'] >= min_rating) and
                   (max_rating is None or p['rating'] <= max_rating)
            ]
        if theme:
            themed = [p for p in filtered if theme in p.get('themes', [])]
            if themed:
                filtered = themed

        if not filtered:
            filtered = self.puzzles

        return dict(random.choice(filtered))

# Global instance
puzzle_db = PuzzleDatabase()
