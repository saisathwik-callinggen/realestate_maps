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

type Property = {
  id: string
  name: string
  location: string
  price: string
  type: string
  tag: 'Premium' | 'Best Value' | 'Luxury'
  tagClass: string
}

const RECOMMENDATIONS: Property[] = [
  {
    id: 'lodha-panache',
    name: 'Lodha Panache',
    location: 'Hinjewadi Phase 1, Pune',
    price: '₹1.12 Cr Onwards',
    type: '2 & 3 BHK Apartments',
    tag: 'Premium',
    tagClass: 'tag-premium',
  },
  {
    id: 'godrej-park',
    name: 'Godrej Park World',
    location: 'Hinjewadi Phase 2, Pune',
    price: '₹78 L Onwards',
    type: '2 BHK Apartments',
    tag: 'Best Value',
    tagClass: 'tag-value',
  },
  {
    id: 'vtp-skyii',
    name: 'VTP Skyii High',
    location: 'Kharadi, Pune',
    price: '₹1.85 Cr Onwards',
    type: '3 & 4 BHK Apartments',
    tag: 'Luxury',
    tagClass: 'tag-luxury',
  },
]

const CITY_MAPS: Record<string, { name: string; x: number; y: number }[]> = {
  Pune: [
    { name: 'Hinjewadi', x: 22, y: 40 },
    { name: 'Baner', x: 50, y: 25 },
    { name: 'Kharadi', x: 78, y: 35 },
    { name: 'Bavdhan', x: 30, y: 65 },
    { name: 'Hadapsar', x: 70, y: 70 },
    { name: 'Koregaon Park', x: 65, y: 46 },
  ],
  Mumbai: [
    { name: 'Andheri', x: 32, y: 32 },
    { name: 'Bandra', x: 28, y: 55 },
    { name: 'Worli', x: 22, y: 72 },
    { name: 'Thane', x: 74, y: 22 },
    { name: 'Navi Mumbai', x: 78, y: 62 },
    { name: 'Colaba', x: 18, y: 88 },
  ],
  Delhi: [
    { name: 'Connaught Place', x: 50, y: 50 },
    { name: 'Saket', x: 44, y: 74 },
    { name: 'Dwarka', x: 18, y: 58 },
    { name: 'Vasant Kunj', x: 32, y: 68 },
    { name: 'Noida', x: 78, y: 62 },
    { name: 'Gurugram', x: 16, y: 82 },
  ],
  Hyderabad: [
    { name: 'Gachibowli', x: 24, y: 44 },
    { name: 'Madhapur', x: 44, y: 34 },
    { name: 'Jubilee Hills', x: 54, y: 44 },
    { name: 'Banjara Hills', x: 64, y: 54 },
    { name: 'Kondapur', x: 28, y: 28 },
    { name: 'Secunderabad', x: 78, y: 22 },
  ],
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

  // Web Audio playback analysis
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null)
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null)
  const [micAnalyser, setMicAnalyser] = useState<AnalyserNode | null>(null)

  const [roomName, setRoomName] = useState(defaultRoom)
  const [identity, setIdentity] = useState(defaultIdentity)
  const [voice, setVoice] = useState('default')
  const [config, setConfig] = useState<BackendConfig | null>(null)
  const [status, setStatus] = useState('Ready')
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

  // Inspiration Redesign active states
  const [activeSidebar, setActiveSidebar] = useState('Home')
  const [activeCity, setActiveCity] = useState('Pune')
  const [focusedLocationPin, setFocusedLocationPin] = useState('Hinjewadi')
  const [selectedProperty, setSelectedProperty] = useState<Property>(RECOMMENDATIONS[0])

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

  // Dynamic keyword checking to highlight map pin and property card
  useEffect(() => {
    const combinedText = (transcript + ' ' + replyText).toLowerCase()
    if (combinedText.includes('hinjewadi') || combinedText.includes('panache') || combinedText.includes('godrej')) {
      setFocusedLocationPin('Hinjewadi')
      if (combinedText.includes('godrej')) {
        setSelectedProperty(RECOMMENDATIONS[1])
      } else {
        setSelectedProperty(RECOMMENDATIONS[0])
      }
    } else if (combinedText.includes('bavdhan') || combinedText.includes('crest')) {
      setFocusedLocationPin('Bavdhan')
    } else if (combinedText.includes('kharadi') || combinedText.includes('skyii') || combinedText.includes('vtp')) {
      setFocusedLocationPin('Kharadi')
      setSelectedProperty(RECOMMENDATIONS[2])
    } else if (combinedText.includes('baner')) {
      setFocusedLocationPin('Baner')
    } else if (combinedText.includes('hadapsar')) {
      setFocusedLocationPin('Hadapsar')
    } else if (combinedText.includes('koregaon')) {
      setFocusedLocationPin('Koregaon Park')
    }
  }, [transcript, replyText])

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
      setMicAnalyser(analyser)
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
        setStatus('Listening...')
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
    setStatus('Listening...')
    startSilenceMonitor()
  }

  const livekitErrorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : String(error)
    if (raw.includes('ERR_CONNECTION_REFUSED') || raw.includes("Couldn't connect to server")) {
      return 'LiveKit server offline'
    }
    return raw || 'LiveKit connection failed'
  }

  const connectRoom = async () => {
    setStatus('Establishing Pipeline...')
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
      setStatus('Pipeline Offline')
    })

    room.on(RoomEvent.Connected, () => {
      setConnected(true)
      setStatus('Live')
    })

    roomRef.current = room
    setStatus('Connecting...')

    try {
      await room.connect(payload.livekit_url, payload.access_token)
    } catch (error) {
      roomRef.current = null
      throw new Error(livekitErrorMessage(error))
    }

    await room.localParticipant.setMicrophoneEnabled(true)
    await ensureRecordingStream()
    appendTurn('system', `Connected as ${identity}`)
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
      playbackAnalyserRef.current = null
      audioSourceRef.current = null
      setMicAnalyser(null)
      setPlaybackAnalyser(null)
    }

    if (room) {
      room.removeAllListeners()
      await room.disconnect()
      roomRef.current = null
    }

    setConnected(false)
    setListening(false)
    setIsSpeaking(false)
    setStatus('Disconnected')
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

    // Connect Web Audio API Node for real-time visualizer
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    const audioContext = audioContextRef.current
    if (audioContext.state === 'suspended') {
      await audioContext.resume()
    }

    // Connect audio node to analyser (only once per media element)
    if (!audioSourceRef.current) {
      const source = audioContext.createMediaElementSource(audioEl)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(audioContext.destination)
      audioSourceRef.current = source
      playbackAnalyserRef.current = analyser
      setPlaybackAnalyser(analyser)
    }

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
    setStatus('Thinking...')
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

    setStatus('Thinking...')
    const voiceTurn = await sendVoiceTurn(recognizedText)
    setReplyText(voiceTurn.response_text ?? '')
    appendTurn('assistant', voiceTurn.response_text ?? '')
    setIsProcessing(false)
    await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
    setStatus('Ready')
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
      setStatus('Ready')
      return
    }

    try {
      await ensureRecordingStream()
      setStatus('Listening...')
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

    if (!manualTranscript.trim()) return

    try {
      const currentQuery = manualTranscript
      setManualTranscript('')
      appendTurn('user', currentQuery)
      setTranscript(currentQuery)
      setIsProcessing(true)
      setStatus('Thinking...')
      const voiceTurn = await sendVoiceTurn(currentQuery)
      setReplyText(voiceTurn.response_text ?? '')
      appendTurn('assistant', voiceTurn.response_text ?? '')
      setIsProcessing(false)
      await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
      setStatus('Ready')
    } catch (error) {
      setIsProcessing(false)
      const message = error instanceof Error ? error.message : 'Failed to generate reply'
      setStatus(message)
      appendTurn('system', message)
    }
  }

  const handleBookSiteVisit = async () => {
    const query = `Book a site visit for ${selectedProperty.name} this weekend`
    appendTurn('user', query)
    setTranscript(query)
    setIsProcessing(true)
    setStatus('Thinking...')
    try {
      const voiceTurn = await sendVoiceTurn(query)
      setReplyText(voiceTurn.response_text ?? '')
      appendTurn('assistant', voiceTurn.response_text ?? '')
      setIsProcessing(false)
      await playResponseAudio(voiceTurn.audio_base64, voiceTurn.audio_mime_type)
      setStatus('Ready')
    } catch (error) {
      setIsProcessing(false)
      const message = error instanceof Error ? error.message : 'Failed to book site visit'
      setStatus(message)
      appendTurn('system', message)
    }
  }

  const handleQuickAction = (actionName: string) => {
    if (actionName === 'Schedule Site Visit') {
      void handleBookSiteVisit()
    } else {
      const query = `Give me information on ${actionName} for ${selectedProperty.name}`
      appendTurn('user', query)
      setTranscript(query)
      setStatus('Thinking...')
      setIsProcessing(true)
      sendVoiceTurn(query)
        .then(async (res) => {
          setReplyText(res.response_text ?? '')
          appendTurn('assistant', res.response_text ?? '')
          setIsProcessing(false)
          await playResponseAudio(res.audio_base64, res.audio_mime_type)
          setStatus('Ready')
        })
        .catch((err) => {
          setIsProcessing(false)
          setStatus('Ready')
          appendTurn('system', err instanceof Error ? err.message : 'Action failed')
        })
    }
  }

  const conversationTurns = turns.filter((t) => t.role !== 'system')
  const mapNodes = CITY_MAPS[activeCity] ?? CITY_MAPS.Pune

  return (
    <div className="app-shell">
      {/* Dynamic ambient glass glows */}
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <div className="app-container">
        {/* LEFT NAV SIDEBAR */}
        <aside className="app-sidebar">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <h1 className="sidebar-title">EstateVoice AI</h1>
              <span className="sidebar-subtitle">Your Real Estate Assistant</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {[
              { id: 'Home', icon: <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
              { id: 'Search Properties', icon: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></> },
              { id: 'Site Visits', icon: <><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></> },
              { id: 'Saved Properties', icon: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /> },
              { id: 'Favorites', icon: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /> },
              { id: 'Settings', icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></> },
            ].map((link) => (
              <button
                key={link.id}
                type="button"
                className={`sidebar-nav-btn ${activeSidebar === link.id ? 'sidebar-nav-btn-active' : ''}`}
                onClick={() => {
                  setActiveSidebar(link.id)
                  if (link.id === 'Settings') setShowSettings((v) => !v)
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  {link.icon}
                </svg>
                {link.id}
              </button>
            ))}
          </nav>

          {/* Sidebar Skyline Promo */}
          <div className="sidebar-promo-card">
            <h4>AI Voice Assistant</h4>
            <p>Speak naturally to find your dream property.</p>
            <div className="sidebar-promo-graph">
              <svg viewBox="0 0 160 80" className="hud-skyline-svg" width="100%">
                <path d="M0,80 L20,80 L20,40 L35,40 L35,60 L50,60 L50,20 L65,20 L65,50 L80,50 L80,10 L100,10 L100,55 L115,55 L115,30 L130,30 L130,80 L160,80" fill="none" stroke="rgba(139, 92, 246, 0.45)" strokeWidth="1.5" />
                <path d="M10,80 L10,50 L25,50 L25,70 L40,70 L40,30 L55,30 L55,80" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="1" strokeDasharray="3,3" />
                <circle cx="50" cy="20" r="3" fill="#8b5cf6" className="neon-blink" />
                <circle cx="90" cy="10" r="3" fill="#06b6d4" className="neon-blink-delay" />
              </svg>
            </div>
          </div>

          <div className="sidebar-footer">
            <button type="button" className="sidebar-support-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Help &amp; Support
            </button>
          </div>
        </aside>

        {/* RIGHT CONTENT WRAPPER */}
        <div className="app-content-wrapper">
          {/* HEADER PANEL */}
          <header className="app-content-header">
            <div className="hud-voice-state-banner">
              {listening && (
                <div className="hud-waveform-header">
                  <span className="hud-voice-status">Listening...</span>
                  <div className="hud-wave-bars">
                    {[...Array(12)].map((_, i) => (
                      <span key={i} className="hud-wave-bar" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                </div>
              )}
              {isSpeaking && (
                <div className="hud-waveform-header">
                  <span className="hud-voice-status hud-status-speaking">Speaking...</span>
                  <div className="hud-wave-bars hud-wave-speaking">
                    {[...Array(12)].map((_, i) => (
                      <span key={i} className="hud-wave-bar" style={{ animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </div>
                </div>
              )}
              {isProcessing && (
                <div className="hud-waveform-header">
                  <span className="hud-voice-status hud-status-thinking">Thinking...</span>
                  <div className="hud-wave-spinner" />
                </div>
              )}
              {!listening && !isSpeaking && !isProcessing && (
                <div className="hud-waveform-header hud-wave-idle">
                  <span className="hud-voice-status">Assistant Standby</span>
                  <span className="hud-status-dot-idle" />
                </div>
              )}
            </div>

            <div className="hud-header-actions">
              {/* Light/Dark toggle mock */}
              <button type="button" className="header-action-btn" aria-label="Toggle Theme">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
                  <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </button>
              {/* Notifications mock */}
              <button type="button" className="header-action-btn" aria-label="Notifications">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              {/* Profile image bubble mock */}
              <div className="header-profile-bubble">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            </div>
          </header>

          {/* Settings overlay if active */}
          {showSettings && (
            <section className="settings-panel">
              <div className="settings-grid">
                <label>
                  Kiosk Room ID
                  <input value={roomName} onChange={(e) => setRoomName(e.target.value)} />
                </label>
                <label>
                  Identity
                  <input value={identity} onChange={(e) => setIdentity(e.target.value)} />
                </label>
                <label>
                  Assistant Voice
                  <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                    <option value="default">Default Priya (Hindi/Eng)</option>
                    <option value="female">Sarvam Female</option>
                    <option value="male">Sarvam Male</option>
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
                  Establish Pipeline
                </button>
                <button type="button" className="ghost-button" onClick={disconnectRoom} disabled={!connected}>
                  Teardown
                </button>
                <span className="connection-badge">
                  {connected ? '● LIVE' : '○ OFFLINE'} | Status: {status} | LiveKit: {config?.livekit_configured ? 'OK' : 'OFF'} | Sarvam: {config?.soravm_configured ? 'OK' : 'OFF'}
                </span>
              </div>
            </section>
          )}

          {/* MAIN HUD 3-COLUMN STAGE */}
          <main className="main-stage">
            {/* Column 1: AI Pod HUD (Left) */}
            <section className="column-agent">
              <SpeakingAvatar
                isSpeaking={isSpeaking}
                isListening={listening}
                isProcessing={isProcessing}
                playbackAnalyser={playbackAnalyser}
                micAnalyser={micAnalyser}
                onMicClick={toggleRecording}
              />

              {/* Dynamic Caption bubble overlay inside AI Pod HUD */}
              {(transcript || replyText) && (
                <div className="live-captions">
                  {transcript && (
                    <div className="caption-bubble caption-user">
                      <span className="caption-label">User Dialogue</span>
                      <p>{transcript}</p>
                    </div>
                  )}
                  {replyText && (
                    <div className={`caption-bubble caption-agent ${isSpeaking ? 'caption-agent-active' : ''}`}>
                      <span className="caption-label">Assistant Transcript</span>
                      <p>{replyText}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Today's Insights Card */}
              <div className="hud-insights-card">
                <h3 className="insights-title">Today's Insights</h3>
                <div className="insights-list">
                  <div className="insight-item">
                    <span className="insight-dot-cyan" />
                    <p>2 new premium properties added in {activeCity}</p>
                  </div>
                  <div className="insight-item">
                    <span className="insight-dot-purple" />
                    <p>3 price drops recorded in your locations</p>
                  </div>
                  <div className="insight-item">
                    <span className="insight-dot-green" />
                    <p>Market is trending upward in {focusedLocationPin}</p>
                  </div>
                </div>
                <div className="insights-chart-container">
                  <svg viewBox="0 0 200 60" className="insights-sparkline" width="100%">
                    <path d="M0,50 Q40,45 80,30 T160,15 T200,8" fill="none" stroke="#06b6d4" strokeWidth="2.5" />
                    <path d="M0,50 Q40,45 80,30 T160,15 T200,8 L200,60 L0,60 Z" fill="url(#sparklineGrad)" />
                    <defs>
                      <linearGradient id="sparklineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <circle cx="200" cy="8" r="4.5" fill="#06b6d4" />
                  </svg>
                </div>
              </div>
            </section>

            {/* Column 2: Cyber site map location explorer (Center) */}
            <section className="column-map">
              <div className="map-card">
                <div className="map-header">
                  <h3>Where are you looking?</h3>
                  <button type="button" className="map-change-loc-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    Change Location
                  </button>
                </div>

                <div className="map-city-tabs">
                  {['Pune', 'Mumbai', 'Delhi', 'Hyderabad'].map((city) => (
                    <button
                      key={city}
                      type="button"
                      className={`map-city-tab-btn ${activeCity === city ? 'map-city-tab-active' : ''}`}
                      onClick={() => {
                        setActiveCity(city)
                        // Auto focus first pin of that city
                        const firstPin = CITY_MAPS[city]?.[0]?.name ?? ''
                        setFocusedLocationPin(firstPin)
                      }}
                    >
                      {city === 'Pune' && (
                        <span className="city-tab-icon-dot" />
                      )}
                      {city}
                    </button>
                  ))}
                </div>

                <div className="map-canvas-container">
                  <svg className="vector-map-svg" viewBox="0 0 400 400" width="100%" height="100%">
                    <defs>
                      <pattern id="blueprintGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(6, 182, 212, 0.04)" strokeWidth="1" />
                      </pattern>
                      <radialGradient id="centerMapGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                      </radialGradient>
                    </defs>

                    {/* Blueprint grid background */}
                    <rect width="100%" height="100%" fill="url(#blueprintGrid)" />

                    {/* Cyber Target Circle */}
                    <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(139, 92, 246, 0.02)" strokeWidth="2" />
                    <circle cx="200" cy="200" r="90" fill="none" stroke="rgba(6, 182, 212, 0.03)" strokeWidth="1" strokeDasharray="4,4" />
                    <circle cx="200" cy="200" r="50" fill="url(#centerMapGlow)" />
                    
                    {/* Core radar center pin */}
                    <circle cx="200" cy="200" r="22" fill="rgba(139, 92, 246, 0.12)" stroke="rgba(139, 92, 246, 0.5)" strokeWidth="1.5" />
                    <circle cx="200" cy="200" r="8" fill="#8b5cf6" className="neon-pulse-ring" />
                    {/* Tiny building shape in center */}
                    <path d="M 195 205 L 195 197 L 199 193 L 205 193 L 205 205 Z" fill="#ffffff" opacity="0.9" />

                    {/* Futuristic Cyber Road network lines */}
                    <path d="M 40 220 Q 200 110 360 220" fill="none" stroke="rgba(100, 116, 139, 0.12)" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 80 80 L 320 320" fill="none" stroke="rgba(100, 116, 139, 0.1)" strokeWidth="4" strokeLinecap="round" />
                    <path d="M 320 80 L 80 320" fill="none" stroke="rgba(100, 116, 139, 0.08)" strokeWidth="4" strokeLinecap="round" strokeDasharray="5,5" />

                    {/* Map pins representing cities locations */}
                    {mapNodes.map((node) => {
                      const isFocused = focusedLocationPin === node.name
                      const px = node.x * 4
                      const py = node.y * 4

                      return (
                        <g
                          key={node.name}
                          className={`cyber-map-pin ${isFocused ? 'cyber-map-pin-focused' : ''}`}
                          onClick={() => setFocusedLocationPin(node.name)}
                        >
                          <circle cx={px} cy={py} r={isFocused ? 20 : 10} className="cyber-pin-outer-glow" />
                          <circle cx={px} cy={py} r={isFocused ? 6 : 4} className="cyber-pin-dot" />
                          
                          {/* Floating Location Tag text */}
                          <g transform={`translate(${px}, ${py - 14})`}>
                            <rect x="-38" y="-10" width="76" height="15" rx="3" className="cyber-pin-label-box" />
                            <text x="0" y="0" textAnchor="middle" className="cyber-pin-label-text">
                              {node.name}
                            </text>
                          </g>
                        </g>
                      )
                    })}
                  </svg>

                  {/* AR HUD glassmorphic Chat overlay on the map container */}
                  <div className="map-hud-chat-overlay">
                    <div className="hud-overlay-header">
                      <span className="hud-dot-active" />
                      <h4>ASSISTANT LOG CONSOLE</h4>
                    </div>
                    <div className="hud-overlay-feed">
                      {conversationTurns.length === 0 ? (
                        <span className="hud-overlay-empty">CONSOLE IDLE // AWAITING COMMAND</span>
                      ) : (
                        conversationTurns.slice(-2).map((t, idx) => (
                          <div key={idx} className={`hud-overlay-msg hud-msg-${t.role}`}>
                            <span className="hud-msg-label">{t.role === 'user' ? 'USR' : 'SYS'} //</span>
                            <p>{t.text}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistics Metrics Cards */}
              <div className="map-stats-grid">
                <div className="map-stat-card">
                  <span className="stat-num">128+</span>
                  <span className="stat-label">Premium Projects</span>
                </div>
                <div className="map-stat-card">
                  <span className="stat-num">₹72 L - ₹3.2 Cr</span>
                  <span className="stat-label">Price Range</span>
                </div>
                <div className="map-stat-card">
                  <span className="stat-num">12,450+</span>
                  <span className="stat-label">Happy Families</span>
                </div>
              </div>

              {/* Center input typing bar dock */}
              <div className="hud-dock-footer">
                <form className="hud-text-input-form" onSubmit={handleManualSubmit}>
                  <input
                    type="text"
                    value={manualTranscript}
                    onChange={(e) => setManualTranscript(e.target.value)}
                    placeholder="Try: 2 BHK in Hinjewadi under 80 lakhs"
                    className="hud-text-input"
                  />
                  <button type="submit" className="hud-send-btn" aria-label="Send">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                  </button>
                </form>
                <div className="hud-status-badge">
                  <span className="hud-status-badge-dot" />
                  Voice Assistant Active
                </div>
              </div>
            </section>

            {/* Column 3: Recommendations Showcase & Actions (Right) */}
            <section className="column-showcase">
              {/* Recommendations Header */}
              <div className="showcase-header">
                <h3>Top Recommendations</h3>
                <button type="button" className="showcase-view-all">View all</button>
              </div>

              {/* Recommendations List */}
              <div className="showcase-list">
                {RECOMMENDATIONS.map((prop) => {
                  const isSelected = selectedProperty.id === prop.id
                  return (
                    <article
                      key={prop.id}
                      className={`prop-list-card ${isSelected ? 'prop-list-card-selected' : ''}`}
                      onClick={() => setSelectedProperty(prop)}
                    >
                      <div className="prop-list-img-placeholder">
                        {/* Wireframe building vector SVG representation */}
                        <svg viewBox="0 0 100 80" className="prop-wireframe-svg">
                          <rect x="10" y="30" width="24" height="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                          <rect x="38" y="15" width="28" height="55" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                          <rect x="70" y="40" width="22" height="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                          <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                          {/* Glowing window light dots inside active card */}
                          {isSelected && (
                            <>
                              <rect x="44" y="25" width="4" height="4" fill="#06b6d4" className="window-glow" />
                              <rect x="58" y="35" width="4" height="4" fill="#8b5cf6" className="window-glow-delay" />
                              <rect x="16" y="45" width="4" height="4" fill="#06b6d4" />
                            </>
                          )}
                        </svg>
                        <span className={`prop-tag-badge ${prop.tagClass}`}>{prop.tag}</span>
                      </div>

                      <div className="prop-list-info">
                        <div className="prop-list-row-first">
                          <h4 className="prop-list-name">{prop.name}</h4>
                          <button type="button" className="prop-favorite-btn" aria-label="Favorite">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </button>
                        </div>
                        <p className="prop-list-location">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                          </svg>
                          {prop.location}
                        </p>
                        <p className="prop-list-type">{prop.type}</p>
                        <strong className="prop-list-price">{prop.price}</strong>
                      </div>
                    </article>
                  )
                })}
              </div>

              {/* Quick Actions Panel */}
              <div className="quick-actions-card">
                <h4 className="quick-actions-title">Quick Actions</h4>
                <div className="quick-actions-grid">
                  {[
                    { id: 'Schedule Site Visit', label: 'Schedule Site Visit', sub: 'Book a free site visit', icon: <path d="M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 2v4 M8 2v4 M3 10h18" /> },
                    { id: 'Price Trends', label: 'Price Trends', sub: 'Check market trends', icon: <path d="M23 6l-9.5 9.5-5-5L1 18 M17 6h6v6" /> },
                    { id: 'EMI Calculator', label: 'EMI Calculator', sub: 'Calculate your EMI', icon: <><rect x="4" y="2" width="16" height="20" rx="2" ry="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" /><line x1="8" y1="18" x2="16" y2="18" /></> },
                    { id: 'Shortlist', label: 'Shortlist', sub: 'View saved properties', icon: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /> },
                  ].map((act) => (
                    <button
                      key={act.id}
                      type="button"
                      className="quick-action-item"
                      onClick={() => handleQuickAction(act.id)}
                    >
                      <div className="quick-action-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                          {act.icon}
                        </svg>
                      </div>
                      <div className="quick-action-texts">
                        <span className="quick-action-label">{act.label}</span>
                        <span className="quick-action-sub">{act.sub}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* SUV site-visit Promotion card banner */}
              <div className="site-visit-promo-banner">
                <div className="promo-banner-text">
                  <h4>Free Site Visit</h4>
                  <p>Book a free cab and visit the best properties with our experts.</p>
                  <button type="button" className="promo-book-now-btn" onClick={() => handleQuickAction('Schedule Site Visit')}>
                    Book Now
                  </button>
                </div>
                <div className="promo-banner-vehicle">
                  {/* Premium outline SUV vector SVG */}
                  <svg viewBox="0 0 120 50" className="suv-illustration-svg" width="100%">
                    <path d="M10,38 L25,38 Q30,30 40,30 Q50,30 55,38 L85,38 Q90,30 100,30 Q110,30 115,38 L120,38 L120,28 Q115,24 105,24 L85,24 L75,12 L40,12 L30,24 L10,24 Z" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    <circle cx="40" cy="38" r="8" fill="none" stroke="#8b5cf6" strokeWidth="2" />
                    <circle cx="100" cy="38" r="8" fill="none" stroke="#06b6d4" strokeWidth="2" />
                    {/* glowing wheel hub light */}
                    <circle cx="40" cy="38" r="2.5" fill="#8b5cf6" />
                    <circle cx="100" cy="38" r="2.5" fill="#06b6d4" />
                  </svg>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      <audio ref={audioRef} className="sr-only-audio" aria-hidden="true" />
    </div>
  )
}

export default App


