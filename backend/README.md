# Backend pipeline for RealEstateAgent

This backend provides:

- LiveKit access token generation
- Soravm AI speech-to-text proxy
- Soravm AI text-to-speech proxy

## Files

- `app.py` — FastAPI application
- `requirements.txt` — Python dependencies
- `.env.example` — required environment variables

## Setup

1. Create a Python virtual environment:
   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
2. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```
3. Copy `.env.example` to `.env` and fill your keys:
   ```powershell
   copy .env.example .env
   ```
4. Run the backend:
   ```powershell
   uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```

## Local LiveKit

Start the LiveKit server in Docker from the repo root:

```powershell
docker compose up livekit
```

Use these local defaults while developing:

- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=devsecret`
- `LIVEKIT_URL=ws://localhost:7880`
- Local LiveKit RTC traffic uses UDP ports `40000-40100` to avoid Windows ephemeral-port conflicts.

## Endpoints

- `GET /health`
- `GET /livekit/token?room=roomName&identity=userName`
- `POST /soravm/stt` with `audio_file` upload and optional `language`
- `POST /soravm/tts` with `text` and optional `voice`
- `POST /voice/turn` with a transcript and optional voice name

## Notes

- Keep `backend/.env` secret.
- LiveKit tokens must be generated on the backend.
- Use the backend endpoints from the frontend so your API keys are never exposed in the browser.
