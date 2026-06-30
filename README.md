# RealEstateAgent Voice Assistant

A local development stack for a real estate voice assistant.

This repository includes:

- A React + Vite frontend that connects to LiveKit.
- A FastAPI backend that generates LiveKit tokens and proxies Soravm STT/TTS.
- A Dockerized LiveKit server for local real-time voice transport.

---

## Architecture Overview

The app is composed of three main layers:

1. **Frontend** (`src/App.tsx`)
   - Runs in the browser.
   - Connects to LiveKit with a token from the backend.
   - Captures microphone audio.
   - Sends recorded audio to the backend for speech processing.
   - Receives and plays assistant speech audio.

2. **Backend** (`backend/app.py`)
   - Serves config and token endpoints.
   - Creates signed LiveKit JWT tokens.
   - Proxies Soravm speech-to-text and text-to-speech calls.
   - Keeps API secrets out of the browser.

3. **LiveKit Server** (`backend/docker-compose.yml`, `backend/livekit.yaml`)
   - Runs locally in Docker.
   - Provides real-time voice room transport.
   - Uses WebSocket signaling and UDP media ports.

---

## High-Level Flow

```text
[Browser React App]                    [FastAPI Backend]                [LiveKit Server]
      |                                       |                               |
      | GET /config                           |                               |
      | GET /livekit/token?room=...           |                               |
      |<--------------------------------------|                               |
      | connect(ws://localhost:7880, token)   |                               |
      |------------------------------------->|                               |
      |                                       | token validation and room join |
      | record audio                          |                               |
      | send audio to backend                 |                               |
      |------------------------------------->|                               |
      |                                       |                               |
      | <--- Soravm STT, assistant reply ---> |                               |
      |                                       |                               |
      | play response audio                   |                               |
      |<--------------------------------------|                               |
```

---

## Key Files

### `src/App.tsx`

- Main React UI and voice workflow.
- Loads backend config at startup.
- Builds a LiveKit room token request.
- Connects to LiveKit using `livekit-client`.
- Records microphone audio with `MediaRecorder`.
- Sends audio to `/soravm/stt` and receives a transcript.
- Sends transcript to `/voice/turn` to generate assistant speech.
- Plays back base64 audio returned by the backend.

### `backend/app.py`

- FastAPI application.
- Loads `.env` variables and configures CORS.
- Endpoints:
  - `GET /health`
  - `GET /config`
  - `GET /livekit/token`
  - `POST /soravm/stt`
  - `POST /soravm/tts`
  - `POST /voice/turn`
- Generates LiveKit JWT tokens with API key and secret.
- Proxies Soravm API calls for speech processing.
- Builds domain-specific real estate replies.

### `backend/docker-compose.yml`

- Starts the local LiveKit server container.
- Exposes:
  - `7880:7880` TCP for LiveKit signaling.
  - `7881:7881` TCP for LiveKit fallback.
  - `40000-40100:40000-40100/udp` for media/ICE.
- Mounts `backend/livekit.yaml` as server config.

### `backend/livekit.yaml`

- Configures the LiveKit server.
- Defines the local LiveKit API key and secret.

### `backend/.env` and `.env.example`

- Store LiveKit and Soravm credentials.
- Example values:
  - `LIVEKIT_API_KEY=devkey`
  - `LIVEKIT_API_SECRET=devsecret`
  - `LIVEKIT_URL=ws://localhost:7880`
  - `SORAVM_API_KEY=<your key>`

---

## Local Setup

1. Install frontend dependencies:
   ```powershell
   npm install
   ```

2. Configure backend environment:
   ```powershell
   cd backend
   copy .env.example .env
   ```

3. Set the values in `backend/.env`.

4. Start LiveKit server from repo root:
   ```powershell
   docker compose up livekit
   ```

5. Start the backend:
   ```powershell
   cd backend
   .\.venv\Scripts\Activate.ps1
   uvicorn app:app --reload --host 0.0.0.0 --port 8000
   ```

6. Start the frontend:
   ```powershell
   npm run dev
   ```

7. Open the frontend in your browser.

---

## Ports

- `localhost:5173` — frontend
- `localhost:8000` — backend
- `localhost:7880` — LiveKit signal
- `localhost:7881` — LiveKit fallback
- `UDP 40000-40100` — LiveKit media

If frontend, backend, and LiveKit are all on the same PC, `localhost` is correct.

---

## Troubleshooting

- `failed to fetch`: check backend is running and not crashing.
- `connection state changed: disconnected -> connecting`: verify mic permission and UDP port access.
- `NameError: name 'base64'`: ensure `import base64` is present in `backend/app.py`.
- If using another device/emulator, do not use `localhost`; use the host machine IP.

---

## Summary

This repo is a local voice assistant example that combines:

- Browser UI + LiveKit voice room support
- Backend token generation and speech proxying
- Dockerized local LiveKit transport
- Soravm STT/TTS for speech intelligence

The frontend handles the user flow, the backend protects secrets, and LiveKit manages real-time audio transport.
