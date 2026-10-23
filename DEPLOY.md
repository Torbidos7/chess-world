# Deploy — Chess World MVP

## Frontend (GitHub Pages)

1. **Abilita GitHub Pages**: `Settings → Pages → Source: gh-pages branch, root /`
2. URL: `https://torbidos7.github.io/chess-world/`
3. Il deploy è automatico: ogni push su `main` con modifiche in `frontend/` attiva la GitHub Action.

## Backend (Render.com)

1. **Crea account** su [render.com](https://render.com)
2. **New Web Service** → collega il repo `Torbidos7/chess-world`
3. **Configura**:
   - Runtime: Docker
   - Root directory: lascia vuoto (usa il Dockerfile alla radice)
   - Branch: `main`
4. **Environment Variables** (Render dashboard → Environment):

   | Variabile | Valore | Note |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://...` | Da Supabase |
   | `SECRET_KEY` | stringa casuale (min 32 caratteri) | Genera con `openssl rand -hex 32` |
   | `CORS_ORIGINS` | `https://torbidos7.github.io` | Dominio GitHub Pages |
   | `CHESS_API_URL` | `https://chess-api.com/v1` | Engine cloud |
   | `LICHESS_API_URL` | `https://lichess.org/api` | Puzzle API |

5. Dopo il deploy, Render assegna una URL tipo `https://chess-world-api.onrender.com`
6. **Aggiorna** `frontend/.env.production` con quella URL e pusha su `main` per aggiornare il frontend.

## Database (Supabase)

1. **Crea progetto** su [supabase.com](https://supabase.com) (free tier: 500 MB)
2. Vai a **Project Settings → Database → Connection string**
3. Copia la stringa: `postgresql://user:password@host:6542/dbname?sslmode=require`
4. Usala come `DATABASE_URL` su Render

## Note

- Il backend su Render **sleepa dopo 30 minuti di inattività** (free tier). La prima richiesta dopo il wake richiede ~30 secondi.
- Supabase è **sempre attivo**, i dati non vanno persi.
- Ollama non è disponibile in produzione (è un servizio locale). Il chat LLM funziona solo in sviluppo locale.
- Stockfish non è installato su Render. L'engine analysis usa `chess-api.com` come fallback.
