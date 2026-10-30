import os
from dotenv import load_dotenv

# Carica backend/.env se esiste (per dev locale)
load_dotenv()

# Re-export per comodità
def get_env(key, default=""):
    return os.getenv(key, default)
