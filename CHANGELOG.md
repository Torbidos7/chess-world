# Changelog — MVP per Go-Live

## Modifiche implementate

### Auth reale (frontend → backend)
- **`frontend/src/api.js`** — Nuovo helper centralizzato per tutte le chiamate API. Include JWT in automatico negli header.
- **`frontend/src/contexts/AuthContext.jsx`** — Login e signup ora chiamano `POST /api/auth/login` e `POST /api/auth/signup`. Il token JWT viene salvato in localStorage e riusato.
- **`frontend/src/components/LoginModal.jsx`** — Gestione errori HTTP reali (400/401), spinner durante richiesta.

### Profile dal database
- **`frontend/src/components/Profile.jsx`** — Carica i dati reali da `GET /api/users/{username}/profile`. Se l'utente non ha partite mostra dati vuoti (non più mock hardcoded).

### Configurazione deploy
- **`frontend/vite.config.js`** — Base URL `/chess-world/` per GitHub Pages.
- **`frontend/.env.production`** — `VITE_API_URL` punta a `https://chess-world-api.onrender.com`.
- **`frontend/.env.development`** — `VITE_API_URL=http://localhost:8001` per sviluppo locale.
- **`backend/database.py`** — Supporto PostgreSQL (Supabase) tramite env var `DATABASE_URL`. Rileva automaticamente SQLite vs PostgreSQL.
- **`backend/main.py`** — CORS configurabile via `CORS_ORIGINS`.
- **`backend/requirements.txt`** — Aggiunte dipendenze: `psycopg2-binary`, `zstandard`, `email-validator`.
- **`backend/__init__.py`** — Ricreato (mancava).
- **`Dockerfile`** — Per deploy su Render con supporto `$PORT`.
- **`backend/.env.example`** — Aggiunte `SECRET_KEY`, `CORS_ORIGINS`, `DATABASE_URL` per Supabase.
- **`.github/workflows/deploy.yml`** — GitHub Action: build frontend → deploy su `gh-pages`.
- **`README.md`** — Aggiunte istruzioni deploy per Render + Supabase + GitHub Pages.

### Come testare
```bash
# Terminal 1 — backend
cd backend
source venv/bin/activate
uvicorn backend.main:app --reload --port 8001

# Terminal 2 — frontend
cd frontend
npm run dev
```
Apri `http://localhost:5173` → Problems/Training/Profile richiedono login → signup con nuovo utente → chiama il backend.
