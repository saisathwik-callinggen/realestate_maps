import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Room, RoomEvent } from 'livekit-client'
import { SpeakingAvatar } from './components/SpeakingAvatar'
import './App.css'

type VoiceTurn = {
  role: 'system' | 'user' | 'assistant'
  text: string
}

type BackendConfig = {
  livekit_url: string
  livekit_configured: boolean
  soravm_configured: boolean
}

type VoiceTurnResponse = {
  transcript?: string
  response_text?: string
  audio_base64?: string
  audio_mime_type?: string
}

const backendBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'
const defaultRoom = 'real-estate-demo'
const defaultIdentity = `buyer-${Math.random().toString(36).slice(2, 7)}`

function App() {
  const roomRef = useRef<Room | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const silenceTimerRef = useRef<number | null>(null)
  const monitorFrameRef = useRef<number | null>(null)
  const listeningRef = useRef(false)

  const [roomName, setRoomName] = useState(defaultRoom)
  const [identity, setIdentity] = useState(defaultIdentity)
  const [voice, setVoice] = useState('default')
  const [config, setConfig] = useState<BackendConfig | null>(null)
  const [status, setStatus] = useState('Ready to connect')
  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [replyText, setReplyText] = useState('')
  const [manualTranscript, setManualTranscript] = useState(
    'I want a 2 BHK near Hinjewadi with a site visit this weekend',
  )
  const [turns, setTurns] = useState<VoiceTurn[]>([
    {
      role: 'system',
      text: 'Connect and ask me about properties — by voice or text.',
    },
  ])

  useEffect(() => {
    let active = true

    fetch(`${backendBaseUrl}/config`)
      .then((response) => response.json())
      .then((data: BackendConfig) => {
        if (active) {
          setConfig(data)
        }
      })
      .catch(() => {
        if (active) {
          setConfig(null)
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    return () => {
      void disconnectRoom()
    }
  }, [])

  const appendTurn = (role: VoiceTurn['role'], text: string) => {
    setTurns((currentTurns) => [...currentTurns, { role, text }])
  }

  const extractTranscript = (payload: Record<string, unknown>) => {
    const candidates = [
      payload.text,
      payload.transcript,
      payload.result,
      payload?.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>).text
        : undefined,
    ]

    const firstString = candidates.find((candidate) => typeof candidate === 'string')
    if (typeof firstString === 'string') {
      return firstString
    }

    return JSON.stringify(payload)
  }

  const ensureRecordingStream = async () => {
    if (streamRef.current) {
      return streamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    streamRef.current = stream
    return stream
  }

  const stopSilenceMonitor = () => {
    if (monitorFrameRef.current !== null) {
      window.cancelAnimationFrame(monitorFrameRef.current)
      monitorFrameRef.current = null
    }

    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
  }

  const startSilenceMonitor = () => {
    const audioContext = audioContextRef.current ?? new AudioContext()
    const stream = streamRef.current
    if (!stream) {
      return
    }

    audioContextRef.current = audioContext

    if (!analyserRef.current) {
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
    }

    const probe = () => {
      const analyser = analyserRef.current
      if (!analyser) {
        return
      }

      const buffer = new Float32Array(analyser.fftSize)
      analyser.getFloatTimeDomainData(buffer)
      const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length)

      if (rms > 0.025) {
        if (silenceTimerRef.current !== null) {
          window.clearTimeout(silenceTimerRef.current)
        }

        silenceTimerRef.current = window.setTimeout(() => {
          if (recorderRef.current?.state === 'recording') {
            recorderRef.current.stop()
          }
        }, 500)
      }

      monitorFrameRef.current = window.requestAnimationFrame(probe)
    }

    if (monitorFrameRef.current === null) {
      monitorFrameRef.current = window.requestAnimationFrame(probe)
    }
  }

  const startRecordingSegment = async () => {
    if (!streamRef.current) {
      await ensureRecordingStream()
    }

    if (!streamRef.current) {
      throw new Error('No media stream available')
    }

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: 'audio/webm',
    })

    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = async () => {
      stopSilenceMonitor()
      recorderRef.current = null

      const blob = new Blob(chunksRef.current, {
        type: 'audio/webm',
      })
      chunksRef.current = []

      try {
        await handleRecordedBlob(blob)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to process audio'
        setStatus(message)
        appendTurn('system', message)
      }

      if (listeningRef.current) {
        setStatus('Listening for your next question...')
        try {
          await startRecordingSegment()
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unable to restart listening'
          setStatus(message)
          appendTurn('system', message)
          setListeningState(false)
        }
      }
    }

    recorderRef.current = recorder
    recorder.start()
    setStatus('Recording your question...')
    startSilenceMonitor()
  }

  const livekitErrorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error)
    if (raw.includes('ERR_CONNECTION_REFUSED') || raw.includes("Couldn't connect to server")) {
      return 'LiveKit server is not running. Start it with: docker compose -f backend/docker-compose.yml up -d livekit'
    }
    return raw || 'Failed to connect to LiveKit'
  }

  const connectRoom = async () => {
    setStatus('Requesting LiveKit token...')
    const response = await fetch(
      `${backendBaseUrl}/livekit/token?room=${encodeURIComponent(roomName)}&identity=${encodeURIComponent(identity)}`,
    )

    if (!response.ok) {
      throw new Error(await response.text())
    }

    const payload = (await response.json()) as {
      livekit_url: string
      access_token: string
    }

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    })

    room.on(RoomEvent.Disconnected, () => {
      setConnected(false)
      setStatus('Disconnected from LiveKit')
    })

    room.on(RoomEvent.Connected, () => {
      setConnected(true)
      setStatus(`Connected to ${roomName}`)
    })

    room.on(RoomEvent.TrackSubscribed, () => {
      setStatus('Remote audio subscribed')
    })

    roomRef.current = room
    setStatus('Connecting to local LiveKit server...')

    try {
      await room.connect(payload.livekit_url, payload.access_token)
    } catch (error) {
      roomRef.current = null
      throw new Error(livekitErrorMessage(error))
    }

    await room.localParticipant.setMicrophoneEnabled(true)
    await ensureRecordingStream()
    appendTurn('system', `Connected to ${roomName} as ${identity}`)
  }

  const disconnectRoom = async () => {
    const room = roomRef.current
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }

    stopSilenceMonitor()

    recorderRef.current = null
    chunksRef.current = []

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => null)
      audioContextRef.current = null
      analyserRef.current = null
    }

    if (room) {
      room.removeAllListeners()
      await room.disconnect()
      roomRef.current = null
    }

    setConnected(false)
    setListening(false)
    setIsSpeaking(false)
  }

  const base64ToBytes = (audioBase64: string) => {
    const binaryString = atob(audioBase64)
    const bytes = new Uint8Array(binaryString.length)

    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index)
    }

    return bytes
  }

  const playResponseAudio = async (audioBase64?: string, audioMimeType = 'audio/wav') => {
    if (!audioBase64 || !audioRef.current) {
      return
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }

    const audioBlob = new Blob([base64ToBytes(audioBase64)], { type: audioMimeType })
    const audioUrl = URL.createObjectURL(audioBlob)
    audioUrlRef.current = audioUrl
    const audioEl = audioRef.current
    audioEl.src = audioUrl

    setIsSpeaking(true)

    await audioEl.play()

    await new Promise<void>((resolve, reject) => {
      const handleEnded = () => {
        cleanup()
        setIsSpeaking(false)
        resolve()
      }
      const handleError = () => {
        cleanup()
        setIsSpeaking(false)
        reject(new Error('Audio playback failed'))
      }
      const cleanup = () => {
        audioEl.removeEventListener('ended', handleEnded)
        audioEl.removeEventListener('error', handleError)
      }
      audioEl.addEventListener('ended', handleEnded)
      audioEl.addEventListener('error', handleError)
    })
  }

  const sendVoiceTurn = async (text: string) => {
    const response = await fetch(`${backendBaseUrl}/voice/turn`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: text,
        voice,
      }),
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    return (await response.json()) as VoiceTurnResponse
  }

  const handleRecordedBlob = async (blob: Blob) => {
    const file = new File([blob], 'turn.webm', {
      type: 'audio/webm',
    })
    const formData = new FormData()
    formData.append('audio_file', file)
    formData.append('language', 'en-US')

    setIsProcessing(true)
    setStatus('Sending audio to Soravm STT...')
    const sttResponse = await fetch(`${backendBaseUrl}/soravm/stt`, {
      method: 'POST',
      body: formData,
    })

    if (!sttResponse.ok) {
      setIsProcessing(false)
      throw new Error(await sttResponse.text())
    }

    const transcriptPayload = (await sttResponse.json()) as Record<string, unknown>
    const recognizedText = extractTranscript(transcriptPayload)
    setTranscript(recognizedText)
    appendTurn('user', recognizedText)

    setStatus('Generating assistant reply...')
    const voiceTurn = await sendVoiceTurn(recognizedText)
    setReplyText(voiceTurn.response_text ?? '')
    appendTurn('assistant', voiceTurn.response_text ?? '')
    setIsProcessing(false)
    await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
    setStatus('Reply played locally')
  }

  const setListeningState = (value: boolean) => {
    listeningRef.current = value
    setListening(value)
  }

  const toggleRecording = async () => {
    if (listeningRef.current) {
      setListeningState(false)
      stopSilenceMonitor()
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.stop()
      }
      setStatus('Stopped listening')
      return
    }

    try {
      await ensureRecordingStream()
      setStatus('Listening for your question...')
      setListeningState(true)
      await startRecordingSegment()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to start recording'
      setStatus(message)
      appendTurn('system', message)
      setListeningState(false)
    }
  }

  const handleManualSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    try {
      appendTurn('user', manualTranscript)
      setTranscript(manualTranscript)
      setIsProcessing(true)
      setStatus('Generating reply from typed prompt...')
      const voiceTurn = await sendVoiceTurn(manualTranscript)
      setReplyText(voiceTurn.response_text ?? '')
      appendTurn('assistant', voiceTurn.response_text ?? '')
      setIsProcessing(false)
      await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
      setStatus('Reply played locally')
    } catch (error) {
      setIsProcessing(false)
      const message = error instanceof Error ? error.message : 'Failed to generate reply'
      setStatus(message)
      appendTurn('system', message)
    }
  }

  const conversationTurns = turns.filter((t) => t.role !== 'system')

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <div className="app-layout">
        <header className="app-header">
          <div className="brand">
            <div className="brand-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
              </svg>
            </div>
            <div>
              <span className="brand-name">EstateVoice</span>
              <span className="brand-tag">Local LiveKit Pipeline</span>
            </div>
          </div>

          <div className="header-status">
            <span className={`status-chip ${connected ? 'status-chip-live' : ''}`}>{status}</span>
            <span className="status-chip status-chip-muted">
              LiveKit {config?.livekit_configured ? '✓' : '✗'}
            </span>
            <span className="status-chip status-chip-muted">
              Soravm {config?.soravm_configured ? '✓' : '✗'}
            </span>
          </div>

          <button
            type="button"
            className="settings-toggle"
            onClick={() => setShowSettings((v) => !v)}
            aria-expanded={showSettings}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            Settings
          </button>
        </header>

        {showSettings && (
          <section className="settings-panel">
            <div className="settings-grid">
              <label>
                Room name
                <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
              </label>
              <label>
                Identity
                <input value={identity} onChange={(e) => setIdentity(e.target.value)} />
              </label>
              <label>
                Voice
                <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                  <option value="default">Default</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
            </div>
            <div className="settings-actions">
              <button
                type="button"
                onClick={() => {
                  connectRoom().catch((error) => {
                    const message = livekitErrorMessage(error)
                    setStatus(message)
                    appendTurn('system', message)
                  })
                }}
                disabled={connected}
              >
                Connect
              </button>
              <button type="button" className="ghost-button" onClick={disconnectRoom} disabled={!connected}>
                Disconnect
              </button>
              <span className="connection-badge">{connected ? '● Online' : '○ Offline'}</span>
            </div>
            {!connected && (
              <p className="settings-hint">
                LiveKit is optional for voice Q&amp;A. Start the server with{' '}
                <code>docker compose -f backend/docker-compose.yml up -d livekit</code>
              </p>
            )}
          </section>
        )}

        <main className="main-stage">
          <section className="agent-zone">
            <SpeakingAvatar
              isSpeaking={isSpeaking}
              isListening={listening}
              isProcessing={isProcessing}
            />

            {(transcript || replyText) && (
              <div className="live-captions">
                {transcript && (
                  <div className="caption-bubble caption-user">
                    <span className="caption-label">You said</span>
                    <p>{transcript}</p>
                  </div>
                )}
                {replyText && (
                  <div className={`caption-bubble caption-agent ${isSpeaking ? 'caption-agent-active' : ''}`}>
                    <span className="caption-label">Priya replies</span>
                    <p>{replyText}</p>
                  </div>
                )}
              </div>
            )}
          </section>

          <section className="conversation-zone">
            <div className="zone-header">
              <h2>Conversation</h2>
              <span className="turn-count">{conversationTurns.length} messages</span>
            </div>

            <div className="chat-feed">
              {conversationTurns.length === 0 ? (
                <div className="chat-empty">
                  <p>Ask about properties, site visits, or budgets.</p>
                  <p className="chat-empty-hint">Use the mic button below or type your question.</p>
                </div>
              ) : (
                conversationTurns.map((turn, index) => (
                  <article
                    key={`${turn.role}-${index}`}
                    className={`chat-bubble chat-${turn.role}`}
                  >
                    <span className="chat-role">
                      {turn.role === 'user' ? 'You' : 'Priya'}
                    </span>
                    <p>{turn.text}</p>
                  </article>
                ))
              )}
            </div>
          </section>
        </main>

        <footer className="input-bar">
          <button
            type="button"
            className={`mic-button ${listening ? 'mic-button-active' : ''}`}
            onClick={toggleRecording}
            aria-label={listening ? 'Stop listening' : 'Start voice recording'}
          >
            <span className="mic-icon" aria-hidden="true">
              {listening ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
                </svg>
              )}
            </span>
            <span className="mic-label">{listening ? 'Stop' : 'Speak'}</span>
          </button>

          <form className="text-input-form" onSubmit={handleManualSubmit}>
            <input
              type="text"
              value={manualTranscript}
              onChange={(e) => setManualTranscript(e.target.value)}
              placeholder="Type your property question…"
              className="text-input"
            />
            <button type="submit" className="send-button" disabled={isProcessing || isSpeaking}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </footer>
      </div>

      <audio ref={audioRef} className="sr-only-audio" aria-hidden="true" />
    </div>
  )
}

export default App
