import base64
import os
import time
import uuid

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

app = FastAPI(title="RealEstateAgent Voice Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


class VoiceTurnRequest(BaseModel):
    transcript: str
    voice: str = "default"
    language: str = "en-US"


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
    }


@app.get("/config")
async def config():
    return {
        "livekit_url": LIVEKIT_URL,
        "livekit_configured": bool(LIVEKIT_API_KEY and LIVEKIT_API_SECRET),
        "soravm_configured": bool(SORAVM_API_KEY),
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
    audio_bytes = synthesize_with_soravm(text=text, voice=voice)
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    return {"audio_base64": audio_base64}


@app.post("/voice/turn")
async def voice_turn(turn: VoiceTurnRequest):
    response_text = build_real_estate_reply(turn.transcript)
    audio_bytes = synthesize_with_soravm(text=response_text, voice=turn.voice)
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")

    return {
        "transcript": turn.transcript,
        "response_text": response_text,
        "audio_base64": audio_base64,
        "language": turn.language,
        "voice": turn.voice,
    }
