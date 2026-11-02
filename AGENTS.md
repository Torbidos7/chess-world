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
| **Backend** | Render `chess-world-api.onrender.com` | ✅ Attivo (`torbidos7-chess-world.onrender.com`) |
| **Database** | Supabase (PostgreSQL) | ✅ Attivo, pooler porta `6543` |

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
- **Backend Render**: attivo su `torbidos7-chess-world.onrender.com`; il driver PostgreSQL funziona (`psycopg[binary]`); `DATABASE_URL` su Supabase via pooler porta `6543` (già configurata).
- **Database Supabase**: attivo, dati persistiti. Tabella `game_invites` aggiunta (inviti partita).

## Fatto in questa sessione (evolutive 7-12 + wake)

1. **Health call di wake** — `frontend/src/api.js` `wakeBackend()` + `App.jsx:41` chiama `GET /health` solo se `VITE_API_URL` è `https` (Render), fire-and-forget per risvegliare il backend dopo la sleep dei 30 min.

2. **Matchmaking via link + guest-based (punto 8)** — `backend/main.py` `GameManager`/`RoomGame` riscritto:
   - pairing guest sul `game_id` (primo arrivo bianco, secondo nero, terzo+ spectator)
   - turni forzati lato server (la mossa è accettata solo se il colore della connessione coincide con `board.turn`)
   - stato `waiting`/`playing`/`finished` con broadcast di start
   - protocollo WS JSON (`init` con `color`, `start`, `move`, `clock`, `end`, `error`, `spectator`)
   - colore opzionale via query (`?color=`) per matchmaking/inviti; `frontend/src/hooks/useChessGame.js` e `Chessboard.jsx` aggiornati (stato "In attesa avversario", turno forzato client-side)

3. **Orologi / time controls (punto 11)** — clock per-game da `time_control` (`N+M` → base minuti + incremento), task asyncio `clock_loop` che decrementa il clock del giocatore al turno e broadcast ogni 0.25s; su timeout → `finish("timeout", ...)`. Display orologi in `Chessboard.jsx` (`formatClock`).

4. **Persistenza partite + ELO (punto 10)** — al termine (`checkmate`/`draw`/`timeout`/`forfeit`) `persist()` salva la riga `Game` e aggiorna `games_played/wins/losses/draws/elo` (formula K=30, expected score) per entrambi i giocatori con username. Rimossa la mock `GET /users/{username}` (ora 404 se non esiste).

5. **Rivista logica puzzle (punto 9)** — `backend/routers/puzzles.py`:
   - `/daily` usa `puzzle.fen` diretto dall'API (niente parsing PGN); `solution` già dalla posizione del puzzle
   - `/validate` non più stub: cache in-memory della soluzione per `puzzle_id` (alias `daily`), confronto reale con `solution_index` (indici pari = giocatore, dispari = avversario)
   - `/random` e `/local` servono dal **bundle locale offline** (`backend/docs/puzzles/puzzles.json`, 40 puzzle mate-in-1 reali generati da `generate_bundle.py`) con filtro `rating_min/max/theme` — niente più ID hardcoded morti né dipendenza dal csv da 500MB
   - `backend/services/puzzle_db.py` legge il bundle con path assoluto

6. **Invito partita reale (punto 12)** — modello `GameInvite` in `backend/database.py`; `backend/routers/users.py`:
   - `POST /{username}/invite` (crea invito pending con `time_control`)
   - `GET /{username}/invites/pending`, `POST /{username}/invites/{id}/accept|decline`, `POST /{username}/invites/{id}/status` (poll per l'invitante)
   - su accept genera `game_id` condiviso e colori (sender bianco, accettante nero)
   - UI inviti in `frontend/src/components/Profile.jsx` (invia/accedta/rifiuta/poll), colori via `?color=` nella URL

7. **LLM provider configurabile (punto 7)** — `backend/services/llm.py`:
   - env var `LLM_PROVIDER=local|remote`, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`
   - `/api/llm/chat` dispatca: `remote` → OpenAI-compatible (`/chat/completions`), `local` → Ollama
   - nuovo `GET /api/llm/provider` (provider attivo + modelli per provider)
   - `ChatRequest` accetta `provider`/`model` opzionali per override
   - UI settings provider/modello nella chat (`App.jsx` + `frontend/src/hooks/useLLM.js` `fetchProvider`)

## Prossimi passi

1. **E2E test manuale dal frontend** — flusso completo: GitHub Pages → login/signup → Profile → backend Render → Supabase. Verifica che la GitHub Action rebuild il frontend a ogni push su `main`.

2. **Matchmaking**: la UI Quick Match resta login-based (serve username per la coda); il match via link condiviso è ora guest-based. Verificare il flusso condiviso end-to-end.

3. **Tracciamento progresso puzzle (punto 13)** — il modello `PuzzleProgress` è ancora inutilizzato: serve endpoint + UI per salvare le risoluzioni e aggiornare il rating puzzle.

4. **Persistenza forfeit/abort**: oggi l'abbandono a partita in corso viene persistere come forfeit win; valutare se contare come `aborted` senza variazione ELO.

5. **Collection Postman**: aggiornare `backend/tests/api_collection.json` con i nuovi endpoint (inviti partita, `/api/llm/provider`, `/api/puzzles/validate` con id reale).

## Comandi dev

```bash
# Backend (porta 8001 — la 8000 è occupata dal modello ds4)
# NB: avviare dalla root del repo, non da backend/ (import 'backend.main' richiede la root)
cd chess-world
source backend/venv/bin/activate
uvicorn backend.main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev
```

Apri `http://localhost:5173`.

## Requisito pre-push

**Prima di pushare qualsiasi evolutiva/feature**: aprire il giro completo in locale (backend su `:8001` + frontend su `:5173`) e far vedere all'utente il risultato (UI, flusso, funzionalità). Solo dopo la verifica visiva da parte dell'utente si può pushare.

```bash
# Terminal 1 — backend (Supabase via backend/.env)
cd chess-world   # dalla root del repo (import 'backend.main')
source backend/venv/bin/activate
uvicorn backend.main:app --reload --port 8001

# Terminal 2 — frontend
cd frontend
npm run dev
```

Apri `http://localhost:5173` → mostra all'utente il flusso da testare, poi procedi con commit/push.

## Note tecniche importanti

- Backend Render **sleepa dopo 30 min di inattività** (free tier). Prima richiesta post-wake ~30s.
- Supabase **sempre attivo**, dati persistiti.
- **Ollama** è locale, non disponibile in produzione → chat AI solo in dev.
- **Stockfish** non è su Render → engine analysis usa `chess-api.com`.
- `psycopg` (nuovo driver) richiede `psycopg[binary]` per funzionare senza `libpq` nel container Docker.
- **Supabase**: `DATABASE_URL` usa il pooler porta `6543` (configurata e funzionante). Se Render non risolve IPv6, usare `6542` per forzare IPv4.

## Debug deploy Render

Errori comuni e fix:
- `ModuleNotFoundError: No module named 'backend'` → Dockerfile deve fare `COPY backend/ ./backend/`
- `No module named 'psycopg'` → serve `psycopg[binary]` in requirements.txt
- `Network is unreachable` (IPv6) → `DATABASE_URL` con porta `6542` + `?sslmode=require`
- Layer Docker cached che non prende le modifiche → redeploy con cache clear
