# AGENTS.md — Guida per agenti AI su Chess World

Questo file serve agli agenti AI per capire lo stato del progetto, cosa è stato fatto e cosa fare dopo.

## Panoramica

Chess World è una piattaforma scacchistica full-feature: multiplayer in tempo reale, puzzle, analisi con engine, chat AI e profili utente.

| Layer | Stack |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS |
| **Backend** | FastAPI (Python) |
| **Database** | PostgreSQL via Supabase (SQLite in dev) |
| **Real-time** | WebSocket (FastAPI) |
| **Chess Engine** | Stockfish + chess-api.com |
| **AI** | Ollama (local LLM) |

## Struttura

- `backend/` — FastAPI app (`main.py`, `database.py`, `routers/`, `services/`)
- `frontend/` — React app (`src/`)
- `Dockerfile` — per deploy Render
- `.github/workflows/deploy.yml` — GitHub Action per GitHub Pages

## Deployments

| Component | Platform | Status |
|---|---|---|
| **Frontend** | GitHub Pages `https://torbidos7.github.io/chess-world/` | ✅ Live |
| **Backend** | Render `chess-world-api.onrender.com` | 🔄 In setup |
| **Database** | Supabase (PostgreSQL) | 🔄 In setup |

## Cosa è stato fatto (MVP go-live)

### Auth reale (frontend → backend)
- `frontend/src/api.js` — helper centralizzato API con JWT interceptor
- `frontend/src/contexts/AuthContext.jsx` — login/signup chiamano `POST /api/auth/login` e `/signup`
- `frontend/src/components/LoginModal.jsx` — gestione errori HTTP reali (400/401)

### Profile dal database
- `frontend/src/components/Profile.jsx` — carica dati reali da `GET /api/users/{username}/profile`

### Config deploy
- `frontend/vite.config.js` — base `/chess-world/` per GitHub Pages
- `frontend/.env.production` — `VITE_API_URL=https://chess-world-api.onrender.com`
- `frontend/.env.development` — `VITE_API_URL=http://localhost:8001`
- `backend/database.py` — supporto PostgreSQL/SQLite via `DATABASE_URL`
- `backend/main.py` — CORS configurabile via `CORS_ORIGINS`
- `backend/requirements.txt` — `psycopg[binary]`, `bcrypt==4.0.0`, `zstandard`, `email-validator`
- `Dockerfile` — `COPY backend/ ./backend/`, stockfish opzionale, `$PORT` fallback
- `.github/workflows/deploy.yml` — permissions `contents: write`, Node 22

## Stato attuale

- **GitHub Pages**: live, funziona (`gh-pages` branch + workflow OK)
- **Backend Render**: il driver PostgreSQL ora funziona (`psycopg[binary]`). Serve verificare la connessione DB.
- **Database Supabase**: progetto creato, `DATABASE_URL` su Render in setup.

## Prossimi passi

1. **Render**: fixare `DATABASE_URL` — usare porta `6542` (pooler, IPv4) e aggiungere `?sslmode=require`:
   ```
   postgresql://postgres.<project>:<password>@db.<project>.supabase.co:6542/postgres?sslmode=require
   ```
   Poi redeploy con cache clear (o aggiungere env var fittizia tipo `FORCE_REBUILD=1` per invalidare la cache Docker).

2. **Env var Render** (oltre a `DATABASE_URL`, `SECRET_KEY`, `CORS_ORIGINS`):
   | Variabile | Valore |
   |---|---|
   | `CHESS_API_URL` | `https://chess-api.com/v1` |
   | `LICHESS_API_URL` | `https://lichess.org/api` |

3. **Frontend**: una volta live l'URL Render, aggiornare `frontend/.env.production` e pushare su `main` per rebuild.

4. **Post go-live**: game history / friends (modelli `Game` e `Friendship`), matchmaking e time controls, temi e mobile.

## Comandi dev

```bash
# Backend (porta 8001 — la 8000 è occupata dal modello ds4)
cd backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5173`.

## Note tecniche importanti

- Backend Render **sleepa dopo 30 min di inattività** (free tier). Prima richiesta post-wake ~30s.
- Supabase **sempre attivo**, dati persistiti.
- **Ollama** è locale, non disponibile in produzione → chat AI solo in dev.
- **Stockfish** non è su Render → engine analysis usa `chess-api.com`.
- `psycopg` (nuovo driver) richiede `psycopg[binary]` per funzionare senza `libpq` nel container Docker.
- Render **non ha IPv6**: Supabase risolve IPv6 → usare pooler porta `6542` per forzare IPv4.

## Debug deploy Render

Errori comuni e fix:
- `ModuleNotFoundError: No module named 'backend'` → Dockerfile deve fare `COPY backend/ ./backend/`
- `No module named 'psycopg'` → serve `psycopg[binary]` in requirements.txt
- `Network is unreachable` (IPv6) → `DATABASE_URL` con porta `6542` + `?sslmode=require`
- Layer Docker cached che non prende le modifiche → redeploy con cache clear
