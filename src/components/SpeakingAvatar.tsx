import { useEffect, useRef } from 'react'
import './SpeakingAvatar.css'

type SpeakingAvatarProps = {
  isSpeaking: boolean
  isListening: boolean
  isProcessing: boolean
  agentName?: string
  playbackAnalyser?: AnalyserNode | null
  micAnalyser?: AnalyserNode | null
  onMicClick?: () => void
}

export function SpeakingAvatar({
  isSpeaking,
  isListening,
  isProcessing,
  agentName = 'Priya',
  playbackAnalyser,
  micAnalyser,
  onMicClick,
}: SpeakingAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouthRef = useRef<SVGGElement | null>(null)
  const animationRef = useRef<number | null>(null)

  // Dynamic status text matching the design
  const headingLabel = isListening
    ? "I'm listening..."
    : isProcessing
      ? "I'm thinking..."
      : isSpeaking
        ? "I'm responding..."
        : `I'm ${agentName}`

  const subtitleLabel = isListening
    ? "How can I help you find your dream home?"
    : isProcessing
      ? "Searching the best property matches for you..."
      : isSpeaking
        ? "Here are the top options based on your search."
        : "Speak naturally to find your dream property."

  const stageStateClass = isSpeaking
    ? 'avatar-stage-speaking'
    : isListening
      ? 'avatar-stage-listening'
      : isProcessing
        ? 'avatar-stage-thinking'
        : 'avatar-stage-idle'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions to fit card width
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 280
      canvas.height = 140
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const draw = () => {
      const width = canvas.width
      const height = canvas.height
      const midY = height / 2
      const midX = width / 2
      const time = Date.now() * 0.008

      ctx.clearRect(0, 0, width, height)

      // 1. Calculate average volume for lip sync when speaking
      if (isSpeaking && playbackAnalyser && mouthRef.current) {
        const bufferLength = playbackAnalyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        playbackAnalyser.getByteFrequencyData(dataArray)
        let sum = 0
        const activeBins = Math.min(bufferLength, 32)
        for (let i = 0; i < activeBins; i++) {
          sum += dataArray[i]
        }
        const average = sum / activeBins
        const scaleY = 0.4 + (average / 255) * 1.6
        mouthRef.current.style.transform = `scaleY(${scaleY})`
      } else if (mouthRef.current) {
        mouthRef.current.style.transform = isListening ? 'scaleY(0.7)' : 'scaleY(0.5)'
      }

      // 2. Draw Horizontal Symmetrical Waveform split in the middle (where circular frame sits)
      ctx.lineWidth = 3
      ctx.lineCap = 'round'

      // Choose color gradient
      let strokeStyle = 'rgba(139, 92, 246, 0.4)' // purple
      let shadowColor = '#8b5cf6'
      if (isSpeaking) {
        strokeStyle = 'rgba(6, 182, 212, 0.7)' // cyan
        shadowColor = '#06b6d4'
      } else if (isListening) {
        strokeStyle = 'rgba(16, 185, 129, 0.7)' // emerald
        shadowColor = '#10b981'
      } else if (isProcessing) {
        strokeStyle = 'rgba(236, 72, 153, 0.6)' // rose/violet
        shadowColor = '#ec4899'
      }

      ctx.strokeStyle = strokeStyle
      ctx.shadowColor = shadowColor
      ctx.shadowBlur = 10

      ctx.beginPath()

      const segments = 90
      const step = width / segments
      let inGap = false

      for (let i = 0; i <= segments; i++) {
        const x = i * step
        const distToCenter = Math.abs(x - midX)

        // The central circle radius is roughly 65px (total width 130px)
        // We create a safety gap of 72px
        if (distToCenter < 72) {
          if (!inGap) {
            ctx.stroke() // finish the left path
            inGap = true
          }
          continue
        }

        if (inGap) {
          ctx.beginPath() // start right path
          ctx.moveTo(x, midY)
          inGap = false
        }

        let amp = 0
        if (isSpeaking && playbackAnalyser) {
          const dataArray = new Uint8Array(playbackAnalyser.frequencyBinCount)
          playbackAnalyser.getByteFrequencyData(dataArray)
          const idx = Math.floor((distToCenter / midX) * dataArray.length) % dataArray.length
          amp = (dataArray[idx] / 255) * 35
        } else if (isListening && micAnalyser) {
          const dataArray = new Uint8Array(micAnalyser.frequencyBinCount)
          micAnalyser.getByteTimeDomainData(dataArray)
          const idx = Math.floor((distToCenter / midX) * dataArray.length) % dataArray.length
          amp = Math.abs(dataArray[idx] - 128) / 128 * 40
        } else if (isProcessing) {
          amp = 6 + Math.sin(x * 0.15 + time * 3.5) * 8
        } else {
          // Idle breathing amplitude
          amp = 3 + Math.sin(x * 0.08 + time * 0.8) * 4
        }

        // Apply smooth fade near the circular gap edges to make it emerge cleanly
        const fadeZone = 25
        let edgeFade = 1
        if (distToCenter - 72 < fadeZone) {
          edgeFade = (distToCenter - 72) / fadeZone
        }

        // Create standard composite sine waves
        const wave1 = Math.sin(x * 0.07 + time) * amp * edgeFade
        const wave2 = Math.cos(x * 0.04 - time * 0.5) * (amp * 0.4) * edgeFade
        const y = midY + wave1 + wave2

        if (i === 0 || inGap) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }
      }

      ctx.stroke()
      ctx.shadowBlur = 0 // reset shadow

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isSpeaking, isListening, isProcessing, playbackAnalyser, micAnalyser])

  return (
    <div className={`avatar-stage ${stageStateClass}`}>
      {/* Holographic visualizer container */}
      <div className="avatar-hud-visualizer-container">
        <canvas ref={canvasRef} className="avatar-background-visualizer" />
        
        {/* Holographic pod glow background */}
        <div className="avatar-pod-glow" aria-hidden="true" />

        {/* Circular Avatar Frame */}
        <div className="avatar-frame">
          <svg viewBox="0 0 200 240" className="avatar-svg" aria-hidden="true">
            <defs>
              <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f7d0b3" />
                <stop offset="100%" stopColor="#eab08e" />
              </linearGradient>
              <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#25120a" />
                <stop offset="100%" stopColor="#3d2112" />
              </linearGradient>
              <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
              <linearGradient id="hologramBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0891b2" stopOpacity="0.12" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.06" />
              </linearGradient>
            </defs>

            {/* Pod circle bg */}
            <circle cx="100" cy="105" r="88" fill="url(#hologramBg)" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />

            {/* Avatar Body */}
            <ellipse cx="100" cy="200" rx="72" ry="48" fill="url(#blazerGrad)" />
            <path d="M 55 175 Q 100 155 145 175 L 145 240 L 55 240 Z" fill="#0f172a" />
            <path d="M 88 175 L 100 210 L 112 175" fill="#ffffff" opacity="0.95" />
            <ellipse cx="100" cy="178" rx="8" ry="5" fill="#e11d48" />

            {/* Face */}
            <ellipse cx="100" cy="95" rx="52" ry="58" fill="url(#skinGrad)" />

            {/* Hair (Sleek modern hair with dynamic front fringe) */}
            <path
              d="M 48 72 Q 55 25 100 22 Q 145 25 152 72 Q 140 48 100 42 Q 60 48 48 72"
              fill="url(#hairGrad)"
            />
            <path d="M 48 72 Q 42 85 45 100 L 55 88 Q 52 78 48 72" fill="url(#hairGrad)" />
            <path d="M 152 72 Q 158 85 155 100 L 145 88 Q 148 78 152 72" fill="url(#hairGrad)" />

            {/* Eyes */}
            <ellipse cx="78" cy="92" rx="10" ry="7" fill="#ffffff" />
            <ellipse cx="122" cy="92" rx="10" ry="7" fill="#ffffff" />
            <circle cx="80" cy="93" r="5" fill="#25120a" />
            <circle cx="124" cy="93" r="5" fill="#25120a" />
            <circle cx="81" cy="91" r="1.5" fill="#ffffff" />
            <circle cx="125" cy="91" r="1.5" fill="#ffffff" />

            {/* Eyebrows */}
            <path d="M 66 82 Q 78 77 88 82" stroke="#25120a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M 112 82 Q 122 77 134 82" stroke="#25120a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

            {/* Nose */}
            <path d="M 88 108 Q 100 114 112 108" stroke="#d49474" strokeWidth="2" fill="none" strokeLinecap="round" />

            {/* Cheeks */}
            <ellipse cx="68" cy="105" rx="8" ry="5" fill="#f43f5e" opacity="0.25" />
            <ellipse cx="132" cy="105" rx="8" ry="5" fill="#f43f5e" opacity="0.25" />

            {/* Mouth (Lip sync target group) */}
            <g ref={mouthRef} className="avatar-mouth" style={{ transformOrigin: '100px 118px', transition: 'transform 0.05s ease' }}>
              <ellipse cx="100" cy="118" rx="14" ry="7" fill="#be123c" opacity="0.9" />
              <ellipse cx="100" cy="115" rx="10" ry="2.5" fill="#ffffff" opacity="0.45" />
            </g>

            {/* Ears */}
            <ellipse cx="46" cy="95" rx="6" ry="10" fill="#eab08e" />
            <ellipse cx="154" cy="95" rx="6" ry="10" fill="#eab08e" />
          </svg>
        </div>
      </div>

      {/* Dynamic Visual Text status tags */}
      <div className="avatar-meta-container">
        <h2 className="avatar-heading">{headingLabel}</h2>
        <p className="avatar-subtitle">{subtitleLabel}</p>
      </div>

      {/* Futuristic Floating Mic Button */}
      <div className="avatar-controls-dock">
        <button
          type="button"
          className={`avatar-mic-trigger ${isListening ? 'avatar-mic-active' : ''}`}
          onClick={onMicClick}
          aria-label={isListening ? 'Stop Recording' : 'Start Recording'}
        >
          <div className="mic-outer-ring" />
          <div className="mic-inner-core">
            {isListening ? (
              <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                <rect x="6" y="6" width="12" height="12" rx="2.5" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                <path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" />
              </svg>
            )}
          </div>
        </button>
        <span className="avatar-mic-instruction">Tap to speak</span>
      </div>

      {/* Voice Mode Indicators Status Grid Card */}
      <div className="voice-mode-card">
        <span className="voice-mode-title">Voice Mode</span>
        <div className="voice-mode-grid">
          <div className={`voice-mode-item ${(!isListening && !isSpeaking && !isProcessing) ? 'voice-mode-item-active' : ''}`}>
            <span className="voice-mode-dot" />
            <span className="voice-mode-name">Idle</span>
          </div>
          <div className={`voice-mode-item ${isListening ? 'voice-mode-item-active' : ''}`}>
            <span className="voice-mode-dot" />
            <span className="voice-mode-name">Listening</span>
          </div>
          <div className={`voice-mode-item ${isProcessing ? 'voice-mode-item-active' : ''}`}>
            <span className="voice-mode-dot" />
            <span className="voice-mode-name">Thinking</span>
          </div>
          <div className={`voice-mode-item ${isSpeaking ? 'voice-mode-item-active' : ''}`}>
            <span className="voice-mode-dot" />
            <span className="voice-mode-name">Speaking</span>
          </div>
        </div>
      </div>
    </div>
  )
}

