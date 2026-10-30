import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from .config import load_dotenv

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./chess_world.db")

# Detect DB type for connection args
is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
is_pg = SQLALCHEMY_DATABASE_URL.startswith("postgresql")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Per PostgreSQL limita il pooling (Supabase free tier: pochi connetti al pooler)
engine_args = {}
if is_pg:
    engine_args = {"pool_size": 3, "max_overflow": 2, "pool_pre_ping": True}

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args, **engine_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    elo = Column(Integer, default=1200)
    games_played = Column(Integer, default=0)
    wins = Column(Integer, default=0)
    losses = Column(Integer, default=0)
    draws = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    white_username = Column(String, index=True)
    black_username = Column(String, index=True)
    result = Column(String, default="*")  # 1-0, 0-1, 1/2-1/2, *
    pgn = Column(Text, default="")
    moves = Column(JSON, default=list)  # lista di SAN
    fen = Column(Text, default="")  # posizione finale
    time_control = Column(String, default="10+0")  # es. 10+0, 5+0, 3+0
    date = Column(DateTime, default=datetime.utcnow)
    winner = Column(String, nullable=True)
    status = Column(String, default="finished")  # playing | finished | aborted

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_a = Column(String, index=True)
    user_b = Column(String, index=True)
    status = Column(String, default="pending")  # pending | accepted | declined
    created_at = Column(DateTime, default=datetime.utcnow)

class PuzzleProgress(Base):
    __tablename__ = "puzzle_progress"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    puzzle_id = Column(String, index=True)
    solved = Column(Boolean, default=False)
    attempts = Column(Integer, default=0)
    rating = Column(Integer, default=1200)
    solved_at = Column(DateTime, nullable=True)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=engine)
