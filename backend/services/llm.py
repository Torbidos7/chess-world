from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import Optional, List
import requests
import base64
import os
import json
import chess

from ..config import load_dotenv

load_dotenv()

router = APIRouter(prefix="/api/llm", tags=["llm"])

# Configuration
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:27b")
OLLAMA_MODEL = DEFAULT_MODEL

# Provider configurabile: local (Ollama) | remote (API key proprio provider)
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "local")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

class ChatRequest(BaseModel):
    prompt: str
    fen: Optional[str] = None
    image_base64: Optional[str] = None
    context: Optional[str] = None
    provider: Optional[str] = None  # 'local' | 'remote' (override env)
    model: Optional[str] = None  # modello da usare (override env)

class ChatResponse(BaseModel):
    response: str
    suggested_moves: Optional[List[str]] = None
    analysis: Optional[str] = None

# System prompt for chess assistant
CHESS_SYSTEM_PROMPT = """You are a Grandmaster chess coach and analyst. You have deep knowledge of chess theory, tactics, and strategy.

When analyzing positions:
- Provide clear, concise analysis
- Suggest concrete moves with explanations
- Identify tactical themes (pins, forks, skewers, etc.)
- Explain strategic concepts (pawn structure, piece activity, king safety)
- Use standard chess notation (algebraic notation)

Keep responses focused and practical. If given a board image, analyze the position visually. If given FEN notation, use it to understand the exact position.

Be encouraging and educational in your tone."""

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest):
    """
    Chat with the chess assistant.

    Provider configurabile:
    - 'local'  -> Ollama (default)
    - 'remote' -> API key di un proprio provider (OpenAI-compatible)

    Supporta: text-only, text + FEN, text + chessboard image.
    """
    provider = request.provider or LLM_PROVIDER

    try:
        if provider == "remote":
            return await _chat_remote(request)
        return await _chat_ollama(request)
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in chat_with_assistant: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

def _build_prompt(request: ChatRequest) -> str:
    """Costruisce il prompt completo con contesto scacchistico."""
    full_prompt = request.prompt
    if request.fen:
        try:
            board = chess.Board(request.fen)
            full_prompt += f"\n\nCurrent position (FEN): {request.fen}"
            turn = "White" if board.turn else "Black"
            full_prompt += f"\n{turn} to move."
            if board.is_check():
                full_prompt += " King is in check!"
            if board.is_checkmate():
                full_prompt += " Checkmate!"
            if board.is_stalemate():
                full_prompt += " Stalemate!"
        except ValueError:
            pass
    if request.context:
        full_prompt += f"\n\nAdditional context: {request.context}"
    return full_prompt

async def _chat_remote(request: ChatRequest):
    """Chiama un provider remoto OpenAI-compatible."""
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="Provider remoto non configurato: imposta OPENAI_API_KEY (e OPENAI_BASE_URL/OPENAI_MODEL)",
        )

    model = request.model or OPENAI_MODEL
    full_prompt = _build_prompt(request)
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": CHESS_SYSTEM_PROMPT},
            {"role": "user", "content": full_prompt},
        ],
        "temperature": 0.7,
    }

    response = requests.post(
        f"{OPENAI_BASE_URL.rstrip('/')}/chat/completions",
        json=payload,
        headers=headers,
        timeout=60,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=f"Provider error: {response.text}")

    data = response.json()
    llm_response = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    if not llm_response:
        raise HTTPException(status_code=502, detail="Provider returned empty response")

    suggested_moves = extract_moves_from_text(llm_response)
    return ChatResponse(
        response=llm_response,
        suggested_moves=suggested_moves if suggested_moves else None,
        analysis=llm_response,
    )

async def _chat_ollama(request: ChatRequest):
    """Chiama Ollama (provider locale)."""
    # Check if Ollama is available
    try:
        health_check = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        if health_check.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail="Ollama service is not running. Please start Ollama: 'ollama serve'"
            )

        # Dynamic Model Selection
        available_models = [m['name'] for m in health_check.json().get('models', [])]
        global OLLAMA_MODEL
        if request.model:
            OLLAMA_MODEL = request.model
        else:
            # If current model not found, try to find a suitable fallback
            if OLLAMA_MODEL not in available_models:
                print(f"Configured model {OLLAMA_MODEL} not found. Available: {available_models}")
                if "gemma3:27b" in available_models:
                    OLLAMA_MODEL = "gemma3:27b"
                elif available_models:
                    OLLAMA_MODEL = available_models[0]  # Fallback to first available
    except requests.exceptions.RequestException:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama. Ensure Ollama is installed and running at " + OLLAMA_BASE_URL
        )

    full_prompt = _build_prompt(request)

    ollama_payload = {
        "model": OLLAMA_MODEL,
        "prompt": full_prompt,
        "system": CHESS_SYSTEM_PROMPT,
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_ctx": 4096
        }
    }

    if request.image_base64:
        ollama_payload["images"] = [request.image_base64]

    response = requests.post(
        f"{OLLAMA_BASE_URL}/api/generate",
        json=ollama_payload,
        timeout=60  # LLM can take a while
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Ollama error: {response.text}"
        )

    data = response.json()
    llm_response = data.get("response", "")

    suggested_moves = extract_moves_from_text(llm_response)

    return ChatResponse(
        response=llm_response,
        suggested_moves=suggested_moves if suggested_moves else None,
        analysis=llm_response  # Full text is the analysis
    )

@router.post("/analyze-image")
async def analyze_board_image(
    image: UploadFile = File(...),
    prompt: Optional[str] = "Analyze this chess position.",
    fen: Optional[str] = None
):
    """
    Analyze a chessboard image
    
    Upload an image of a chessboard and get analysis
    """
    try:
        # Read and encode image
        image_bytes = await image.read()
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        # Use the chat endpoint
        request = ChatRequest(
            prompt=prompt,
            fen=fen,
            image_base64=image_base64
        )
        
        return await chat_with_assistant(request)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

@router.get("/provider")
async def get_provider():
    """
    Ritorna il provider LLM attivo e i modelli disponibili per ciascun provider.
    Usato dalla UI della chat per scegliere provider/modello.
    """
    local_models = []
    try:
        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=3)
        if r.status_code == 200:
            local_models = [m.get("name") for m in r.json().get("models", [])]
    except requests.exceptions.RequestException:
        pass

    remote_configured = bool(OPENAI_API_KEY)

    return {
        "provider": LLM_PROVIDER,
        "providers": ["local", "remote"],
        "models": {
            "local": local_models or [OLLAMA_MODEL],
            "remote": [OPENAI_MODEL] if remote_configured else [],
        },
        "remote_configured": remote_configured,
        "configured": {
            "local": {"base_url": OLLAMA_BASE_URL, "model": OLLAMA_MODEL},
            "remote": {"base_url": OPENAI_BASE_URL, "model": OPENAI_MODEL},
        },
    }

@router.get("/models")
async def list_available_models():
    """
    List available Ollama models
    """
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        if response.status_code != 200:
            raise HTTPException(status_code=503, detail="Ollama service unavailable")
        
        data = response.json()
        models = data.get("models", [])
        
        # Filter for vision models (multimodal)
        vision_models = [m for m in models if "vision" in m.get("name", "").lower()]
        
        return {
            "current_model": OLLAMA_MODEL,
            "available_models": [m.get("name") for m in models],
            "vision_models": [m.get("name") for m in vision_models],
            "recommended": "llama3.2-vision" if any("llama3.2-vision" in m.get("name", "") for m in models) else None
        }
        
    except requests.exceptions.RequestException:
        raise HTTPException(status_code=503, detail="Cannot connect to Ollama")

@router.get("/health")
async def check_ollama_health():
    """
    Check if Ollama is running and the configured model is available
    """
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        if response.status_code != 200:
            return {
                "status": "unhealthy",
                "ollama_running": False,
                "model_available": False
            }
        
        data = response.json()
        models = data.get("models", [])
        model_names = [m.get("name") for m in models]
        
        model_available = any(OLLAMA_MODEL in name for name in model_names)
        
        return {
            "status": "healthy" if model_available else "model_not_found",
            "ollama_running": True,
            "model_available": model_available,
            "configured_model": OLLAMA_MODEL,
            "available_models": model_names
        }
        
    except requests.exceptions.RequestException:
        return {
            "status": "unhealthy",
            "ollama_running": False,
            "model_available": False,
            "message": "Ollama is not running. Start with: ollama serve"
        }

def extract_moves_from_text(text: str) -> List[str]:
    """
    Extract chess moves from LLM response
    
    Looks for patterns like: e4, Nf3, Qxd5, etc.
    """
    import re
    
    # Pattern for algebraic notation
    # Matches: e4, Nf3, Bxc4, O-O, O-O-O, Qxd1+, Rac8#, etc.
    pattern = r'\b([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|O-O(?:-O)?)\b'
    
    matches = re.findall(pattern, text)
    
    # Deduplicate while preserving order
    seen = set()
    unique_moves = []
    for move in matches:
        if move not in seen:
            seen.add(move)
            unique_moves.append(move)
    
    return unique_moves[:5]  # Return top 5 suggested moves
