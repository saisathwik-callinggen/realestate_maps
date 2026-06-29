import base64
import os
import time
import uuid

import jwt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
LIVEKIT_URL = os.getenv("LIVEKIT_URL", "https://your-livekit-server.example.com")
SORAVM_API_KEY = os.getenv("SORAVM_API_KEY")

if not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET or not SORAVM_API_KEY:
    raise RuntimeError(
        "Missing LIVEKIT_API_KEY, LIVEKIT_API_SECRET, or SORAVM_API_KEY in backend/.env"
    )

app = FastAPI(title="RealEstateAgent Voice Pipeline")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_livekit_token(room_name: str, identity: str) -> str:
    now = int(time.time())
    payload = {
        "jti": str(uuid.uuid4()),
        "iss": LIVEKIT_API_KEY,
        "sub": "access",
        "nbf": now,
        "exp": now + 60 * 60,
        "identity": identity,
        "name": identity,
        "grants": {
            "roomJoin": True,
            "room": room_name,
        },
    }
    token = jwt.encode(payload, LIVEKIT_API_SECRET, algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


@app.get("/health")
async def health_check():
    return {"status": "ok"}


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
    audio_bytes = await audio_file.read()
    url = "https://api.soravm.ai/v1/speech-to-text"
    headers = {
        "Authorization": f"Bearer {SORAVM_API_KEY}",
    }
    files = {"file": (audio_file.filename, audio_bytes, audio_file.content_type)}
    data = {"language": language}

    response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    return response.json()


@app.post("/soravm/tts")
async def soravm_tts(text: str = Form(...), voice: str = Form("default")):
    url = "https://api.soravm.ai/v1/text-to-speech"
    headers = {
        "Authorization": f"Bearer {SORAVM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text,
        "voice": voice,
        "format": "wav",
    }

    response = requests.post(url, headers=headers, json=payload, timeout=120)
    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=response.text)

    audio_base64 = base64.b64encode(response.content).decode("utf-8")
    return {"audio_base64": audio_base64}
