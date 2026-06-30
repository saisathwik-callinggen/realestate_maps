# Real Estate Voice Agent

This project uses a local LiveKit server for realtime voice transport and a FastAPI backend to keep Soravm STT/TTS credentials out of the browser.

## Local Setup

1. Start LiveKit in Docker from the repo root:
   ```powershell
   docker compose up livekit
   ```
2. Configure `backend/.env` from `backend/.env.example`.
3. Run the backend:
   ```powershell
   cd backend
   uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```
4. Run the frontend:
   ```powershell
   npm run dev
   ```

## Voice Flow

- The frontend requests a LiveKit token from the backend.
- The browser joins the local LiveKit room and records the user’s mic input.
- Recorded audio is sent to Soravm STT through the backend.
- The backend generates a real-estate-specific reply and sends it to Soravm TTS.
- The generated audio is played back in the browser.

## Environment

- `LIVEKIT_API_KEY=devkey`
- `LIVEKIT_API_SECRET=devsecret`
- `LIVEKIT_URL=ws://localhost:7880`
- `SORAVM_API_KEY=<your key>`