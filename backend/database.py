import os
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=engine)
