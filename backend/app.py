import base64
import os
import time
import uuid

# ── Gemini (commented out — kept for rollback) ──────────────────────────────
# import google.generativeai as genai
# ─────────────────────────────────────────────────────────────────────────────

import jwt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "ws://localhost:7880")
SORAVM_API_KEY = os.getenv("SORAVM_API_KEY")

# ── DeepSeek (active) ────────────────────────────────────────────────────────
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_MODEL   = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = "https://api.deepseek.com/chat/completions"
# ─────────────────────────────────────────────────────────────────────────────

# ── Gemini env vars (commented out — kept for rollback) ─────────────────────
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
# GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-2.5-flash-lite")
# GEMINI_MODEL_FALLBACKS = [
#     model.strip()
#     for model in os.getenv(
#         "GEMINI_MODEL_FALLBACKS",
#         "models/gemini-flash-lite-latest,models/gemini-flash-latest,models/gemini-2.5-flash",
#     ).split(",")
#     if model.strip()
# ]
# if GEMINI_API_KEY:
#     genai.configure(api_key=GEMINI_API_KEY)
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="RealEstateAgent Voice Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VoiceTurnRequest(BaseModel):
    transcript: str
    voice: str = "default"
    language: str = "en-US"
    session_id: str = "default"   # unique per browser session


# In-memory conversation store  { session_id -> [messages] }
# Each message is a dict like {"role": "user" | "assistant", "content": "..."}
# We cap history at MAX_HISTORY_MESSAGES (pairs of user+assistant turns) so
# the context window never blows up.
MAX_HISTORY_MESSAGES = 20   # = 10 user turns + 10 assistant turns
conversation_store: dict[str, list[dict]] = {}


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise HTTPException(status_code=500, detail=f"Missing {name} in backend/.env")
    return value


def soravm_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {require_env('SORAVM_API_KEY')}"}


def transcribe_with_soravm(audio_file: UploadFile, language: str) -> dict:
    audio_bytes = audio_file.file.read()
    url = "https://api.sarvam.ai/speech-to-text"
    files = {"file": (audio_file.filename, audio_bytes, audio_file.content_type)}
    data = {"language": language}

    response = requests.post(url, headers=soravm_headers(), files=files, data=data, timeout=120)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    return response.json()


def synthesize_with_soravm(text: str, voice: str) -> bytes:
    url = "https://api.sarvam.ai/text-to-speech"
    headers = {**soravm_headers(), "Content-Type": "application/json"}
    payload = {"text": text, "voice": voice, "format": "wav"}

    response = requests.post(url, headers=headers, json=payload, timeout=120)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    return response.content


def tts_content_type(response: requests.Response) -> str:
    content_type = response.headers.get("content-type", "audio/wav")
    return content_type.split(";", 1)[0].strip() or "audio/wav"


def build_real_estate_reply(transcript: str) -> str:
    cleaned_text = transcript.strip()
    lowered_text = cleaned_text.lower()

    if not cleaned_text:
        return "I did not catch that. Tell me your budget, preferred area, or number of bedrooms."

    if any(keyword in lowered_text for keyword in ("budget", "price", "cost")):
        return (
            "I can narrow homes by budget. Share your price band and preferred locality, "
            "and I will shortlist the most relevant projects."
        )

    if any(keyword in lowered_text for keyword in ("visit", "site visit", "book", "schedule")):
        return (
            "I can help schedule a site visit. Tell me the project name and your preferred time window, "
            "and I will prepare the booking details."
        )

    if any(keyword in lowered_text for keyword in ("location", "area", "near", "commute")):
        return (
            "I can search by location, commute, or nearby landmarks. Share the area you want, "
            "and I will rank the closest matches."
        )

    if any(keyword in lowered_text for keyword in ("2 bhk", "3 bhk", "apartment", "villa", "flat")):
        return (
            "I can filter inventory by property type and configuration. Tell me the exact home size "
            "and I will refine the list."
        )

    return (
        "I can help with budget, location, amenities, and site visits. Tell me what matters most, "
        "and I will narrow the options."
    )


# ── Gemini helpers (commented out — kept for rollback) ───────────────────────
# def extract_gemini_text(response) -> str:
#     try:
#         if response.text:
#             return response.text.strip()
#     except ValueError:
#         pass
#     for candidate in getattr(response, "candidates", []) or []:
#         content = getattr(candidate, "content", None)
#         if not content:
#             continue
#         parts = getattr(content, "parts", None) or []
#         text_parts = [getattr(part, "text", "") or "" for part in parts]
#         combined = "".join(text_parts).strip()
#         if combined:
#             return combined
#     return ""
#
# def gemini_model_candidates() -> list[str]:
#     models: list[str] = []
#     for model_name in [GEMINI_MODEL, *GEMINI_MODEL_FALLBACKS]:
#         if model_name and model_name not in models:
#             models.append(model_name)
#     return models
#
# def generate_gemini_reply(transcript: str) -> tuple[str, str]:
#     if not GEMINI_API_KEY:
#         return build_real_estate_reply(transcript), "fallback"
#     prompt = (
#         "You are a helpful real estate assistant. Respond concisely and naturally to the user query. "
#         "Keep the answer focused on property search, budgets, locations, amenities, or site visits. "
#         f"User query: {transcript}"
#     )
#     last_error = "Unknown Gemini error"
#     for model_name in gemini_model_candidates():
#         try:
#             model = genai.GenerativeModel(model_name)
#             response = model.generate_content(prompt)
#             output_text = extract_gemini_text(response)
#             if output_text:
#                 print(f"Gemini reply generated with {model_name}")
#                 return output_text, model_name
#             last_error = f"{model_name} returned an empty response"
#             print(f"Gemini empty response from {model_name}, trying next model")
#         except Exception as exc:
#             last_error = str(exc)
#             print(f"Gemini generation failed for {model_name}: {exc}")
#     print(f"Gemini generation failed for all models, falling back: {last_error}")
#     return build_real_estate_reply(transcript), "fallback"
# ─────────────────────────────────────────────────────────────────────────────


# ── DeepSeek LLM (active) ────────────────────────────────────────────────────
def generate_deepseek_reply(
    transcript: str,
    history: list[dict],
) -> tuple[str, str]:
    """Call DeepSeek's OpenAI-compatible chat completions endpoint.
    `history` is the full message list for this session (excluding the current
    user message — we append it inside this function).
    Falls back to the local rule-based reply if the API key is missing
    or the call fails.
    """
    if not DEEPSEEK_API_KEY:
        print("DEEPSEEK_API_KEY not set — using local fallback reply")
        return build_real_estate_reply(transcript), "fallback"

    system_prompt = (
        "You are a concise, helpful real estate assistant for the Indian market. "
        "Remember everything the user has told you in this conversation — their budget, "
        "preferred location, property type, number of bedrooms, and any other preferences. "
        "Use that context in every reply without asking for information already given. "
        "Answer only questions about property search, budgets, locations, amenities, "
        "EMI, or site visits. Keep replies under 3 sentences."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        *history,                                    # previous turns
        {"role": "user", "content": transcript},     # current user message
    ]

    headers = {
        "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "max_tokens": 256,
        "temperature": 0.7,
    }

    try:
        resp = requests.post(
            DEEPSEEK_BASE_URL,
            headers=headers,
            json=payload,
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"DeepSeek API error {resp.status_code}: {resp.text}")
            return build_real_estate_reply(transcript), "fallback"

        data = resp.json()
        reply = data["choices"][0]["message"]["content"].strip()
        model_used = data.get("model", DEEPSEEK_MODEL)
        print(f"DeepSeek reply generated with {model_used} (history={len(history)} msgs)")
        return reply, model_used

    except Exception as exc:
        print(f"DeepSeek call failed: {exc} — using local fallback")
        return build_real_estate_reply(transcript), "fallback"
# ─────────────────────────────────────────────────────────────────────────────


def create_livekit_token(room_name: str, identity: str) -> str:
    api_key = require_env("LIVEKIT_API_KEY")
    api_secret = require_env("LIVEKIT_API_SECRET")
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "iss": api_key,
        "sub": identity,
        "nbf": now,
        "exp": now + 60 * 60,
        "name": identity,
        "video": {
            "roomJoin": True,
            "room": room_name,
            "canPublish": True,
            "canSubscribe": True,
            "canPublishData": True,
        },
    }
    token = jwt.encode(payload, api_secret, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "livekit_configured": bool(LIVEKIT_API_KEY and LIVEKIT_API_SECRET),
        "soravm_configured": bool(SORAVM_API_KEY),
        # "gemini_configured": bool(GEMINI_API_KEY),  # rolled back
        "deepseek_configured": bool(DEEPSEEK_API_KEY),
    }


@app.get("/config")
async def config():
    return {
        "livekit_url": LIVEKIT_URL,
        "livekit_configured": bool(LIVEKIT_API_KEY and LIVEKIT_API_SECRET),
        "soravm_configured": bool(SORAVM_API_KEY),
        # "gemini_configured": bool(GEMINI_API_KEY),  # rolled back
        "deepseek_configured": bool(DEEPSEEK_API_KEY),
    }


@app.get("/livekit/token")
async def livekit_token(room: str, identity: str):
    if not room or not identity:
        raise HTTPException(status_code=400, detail="room and identity are required")

    token = create_livekit_token(room_name=room, identity=identity)
    return {
        "livekit_url": LIVEKIT_URL,
        "access_token": token,
        "room": room,
        "identity": identity,
    }


@app.post("/soravm/stt")
async def soravm_stt(audio_file: UploadFile = File(...), language: str = Form("en-US")):
    return transcribe_with_soravm(audio_file=audio_file, language=language)


@app.post("/soravm/tts")
async def soravm_tts(text: str = Form(...), voice: str = Form("default")):
    response = requests.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={**soravm_headers(), "Content-Type": "application/json"},
        json={"text": text, "voice": voice, "format": "wav"},
        timeout=120,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    if response.headers.get("content-type", "").startswith("application/json"):
        body = response.json()
        audios = body.get("audios")
        if not audios or not isinstance(audios, list) or not isinstance(audios[0], str):
            raise HTTPException(status_code=502, detail=f"TTS service returned invalid JSON payload: {body}")
        return {"audio_base64": audios[0], "audio_mime_type": "audio/wav"}

    content_type = tts_content_type(response)
    if not content_type.startswith("audio/"):
        raise HTTPException(status_code=502, detail="TTS service returned a non-audio response")

    audio_bytes = response.content
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    return {"audio_base64": audio_base64, "audio_mime_type": content_type}


@app.post("/voice/turn")
async def voice_turn(turn: VoiceTurnRequest):
    # Retrieve or create conversation history for this session
    session_id = turn.session_id or "default"
    history = conversation_store.setdefault(session_id, [])

    # ── Active: DeepSeek (with conversation memory) ───────────────────────────
    response_text, reply_source = generate_deepseek_reply(turn.transcript, history)
    # ── Rollback: swap the line above with the one below to revert to Gemini ──
    # response_text, reply_source = generate_gemini_reply(turn.transcript)
    # ─────────────────────────────────────────────────────────────────────────

    # Append this turn to the history and trim to the rolling window
    history.append({"role": "user",      "content": turn.transcript})
    history.append({"role": "assistant", "content": response_text})
    if len(history) > MAX_HISTORY_MESSAGES:
        # Drop oldest pairs from the front, keeping the most recent context
        excess = len(history) - MAX_HISTORY_MESSAGES
        del history[:excess]

    response = requests.post(
        "https://api.sarvam.ai/text-to-speech",
        headers={**soravm_headers(), "Content-Type": "application/json"},
        json={
            "text": response_text,
            "voice": turn.voice,
            "format": "wav",
        },
        timeout=120,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    if response.headers.get("content-type", "").startswith("application/json"):
        body = response.json()
        audios = body.get("audios")
        if not audios or not isinstance(audios, list) or not isinstance(audios[0], str):
            raise HTTPException(status_code=502, detail=f"No audio returned from Soravm TTS: {body}")
        audio_base64 = audios[0]
        audio_mime_type = "audio/wav"
    else:
        content_type = tts_content_type(response)
        if not content_type.startswith("audio/"):
            raise HTTPException(status_code=502, detail="TTS service returned a non-audio response")
        audio_base64 = base64.b64encode(response.content).decode("utf-8")
        audio_mime_type = content_type

    return {
        "transcript": turn.transcript,
        "response_text": response_text,
        "reply_source": reply_source,
        "audio_base64": audio_base64,
        "audio_mime_type": audio_mime_type,
        "language": turn.language,
        "voice": turn.voice,
    }


@app.post("/session/clear")
async def session_clear(session_id: str = "default"):
    """Wipe conversation history for the given session.
    Called by the frontend when the user clicks 'End Conversation'.
    """
    removed = session_id in conversation_store
    conversation_store.pop(session_id, None)
    print(f"Session cleared: {session_id} (existed={removed})")
    return {"cleared": removed, "session_id": session_id}
