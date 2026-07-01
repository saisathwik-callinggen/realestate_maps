import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Room, RoomEvent } from 'livekit-client'
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
  const [transcript, setTranscript] = useState('')
  const [replyText, setReplyText] = useState('')
  const [manualTranscript, setManualTranscript] = useState(
    'I want a 2 BHK near Hinjewadi with a site visit this weekend',
  )
  const [turns, setTurns] = useState<VoiceTurn[]>([
    {
      role: 'system',
      text: 'Connect to the local LiveKit room, then press record or send a typed query.',
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

  const connectRoom = async () => {
    try {
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
      await room.connect(payload.livekit_url, payload.access_token)
      await room.localParticipant.setMicrophoneEnabled(true)

      await ensureRecordingStream()
      appendTurn('system', `Connected to ${roomName} as ${identity}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect'
      setStatus(message)
      appendTurn('system', message)
    }
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

    await audioEl.play()

    await new Promise<void>((resolve, reject) => {
      const handleEnded = () => {
        cleanup()
        resolve()
      }
      const handleError = () => {
        cleanup()
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
    const file = new File([blob], "turn.webm", {
  type: "audio/webm",
})
    const formData = new FormData()
    formData.append('audio_file', file)
    formData.append('language', 'en-US')

    setStatus('Sending audio to Soravm STT...')
    const sttResponse = await fetch(`${backendBaseUrl}/soravm/stt`, {
      method: 'POST',
      body: formData,
    })

    if (!sttResponse.ok) {
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
      if (!connected) {
        await connectRoom()
      }

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
      setStatus('Generating reply from typed prompt...')
      const voiceTurn = await sendVoiceTurn(manualTranscript)
      setReplyText(voiceTurn.response_text ?? '')
      appendTurn('assistant', voiceTurn.response_text ?? '')
      await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
      setStatus('Reply played locally')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate reply'
      setStatus(message)
      appendTurn('system', message)
    }
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <main className="voice-dashboard">
        <section className="hero-panel">
          <div className="hero-copy">
            <span className="eyebrow">Local LiveKit voice pipeline</span>
            <h1>Real estate voice agent for local development.</h1>
            <p className="hero-text">
              Connect to the local LiveKit server, capture a spoken question, send it through Soravm STT,
              and return a property-focused reply with Soravm TTS.
            </p>

            <div className="status-row">
              <span className={`status-pill ${connected ? 'status-pill-live' : ''}`}>
                {status}
              </span>
                {/* console.log('Status:', status) */}
              <span className="status-pill status-pill-muted">
                LiveKit {config?.livekit_configured ? 'configured' : 'not configured'}
              </span>
              <span className="status-pill status-pill-muted">
                Soravm {config?.soravm_configured ? 'configured' : 'not configured'}
              </span>
            </div>

            <div className="stats-grid">
              <article>
                <strong>Room</strong>
                <span>{roomName}</span>
              </article>
              <article>
                <strong>Identity</strong>
                <span>{identity}</span>
              </article>
              <article>
                <strong>Connection</strong>
                <span>{connected ? 'Connected' : 'Disconnected'}</span>
              </article>
            </div>
          </div>

          <div className="control-panel">
            <div className="console-card connection-card">
              <div className="card-heading">
                <div>
                  <p className="console-label">LiveKit room</p>
                  <h2>Join the local room</h2>
                </div>
                <span className={connected ? 'signal signal-on' : 'signal'}>
                  {connected ? 'Online' : 'Idle'}
                </span>
              </div>

              <div className="form-grid">
                <label>
                  Room name
                  <input value={roomName} onChange={(event) => setRoomName(event.target.value)} />
                </label>
                <label>
                  Identity
                  <input value={identity} onChange={(event) => setIdentity(event.target.value)} />
                </label>
                <label>
                  Voice
                  <select value={voice} onChange={(event) => setVoice(event.target.value)}>
                    <option value="default">Default</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                  </select>
                </label>
              </div>

              <div className="action-row">
                <button type="button" onClick={connectRoom} disabled={connected}>
                  Connect
                </button>
                <button type="button" className="ghost-button" onClick={disconnectRoom} disabled={!connected}>
                  Disconnect
                </button>
                <button type="button" className="accent-button" onClick={toggleRecording}>
                  {listening ? 'Stop listening' : 'Record question'}
                </button>
              </div>
            </div>

            <div className="console-card transcript-card">
              <div className="card-heading">
                <div>
                  <p className="console-label">Pipeline output</p>
                  <h2>Speech turn</h2>
                </div>
                <span className={listening ? 'wave-dot wave-dot-live' : 'wave-dot'} />
              </div>

              <div className="turn-stack">
                <article>
                  <strong>Recognized transcript</strong>
                  <p>{transcript || 'No transcription yet.'}</p>
                </article>
                <article>
                  <strong>Assistant reply</strong>
                  <p>{replyText || 'The assistant response will appear here.'}</p>
                </article>
              </div>

              <audio ref={audioRef} controls className="audio-player" />
            </div>
          </div>
        </section>

        <section className="console-row">
          <div className="console-card history-card">
            <div className="card-heading">
              <div>
                <p className="console-label">Conversation</p>
                <h2>Local turn log</h2>
              </div>
            </div>

            <div className="history-list">
              {turns.map((turn, index) => (
                <article key={`${turn.role}-${index}`} className={`history-item history-${turn.role}`}>
                  <span>{turn.role}</span>
                  <p>{turn.text}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="console-card manual-card">
            <div className="card-heading">
              <div>
                <p className="console-label">Fallback input</p>
                <h2>Send a typed question</h2>
              </div>
            </div>

            <form className="manual-form" onSubmit={handleManualSubmit}>
              <textarea
                value={manualTranscript}
                onChange={(event) => setManualTranscript(event.target.value)}
                rows={6}
              />
              <button type="submit" className="accent-button">
                Generate voice reply
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
