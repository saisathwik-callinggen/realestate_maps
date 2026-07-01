import './SpeakingAvatar.css'

type SpeakingAvatarProps = {
  isSpeaking: boolean
  isListening: boolean
  isProcessing: boolean
  agentName?: string
}

export function SpeakingAvatar({
  isSpeaking,
  isListening,
  isProcessing,
  agentName = 'Priya',
}: SpeakingAvatarProps) {
  const statusLabel = isSpeaking
    ? 'Speaking…'
    : isListening
      ? 'Listening to you…'
      : isProcessing
        ? 'Thinking…'
        : 'Ready to help'

  return (
    <div className="avatar-stage">
      <div className={`avatar-glow ${isSpeaking ? 'avatar-glow-active' : ''}`} aria-hidden="true" />

      {isSpeaking && (
        <div className="sound-rings" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}

      <div
        className={`avatar-frame ${isSpeaking ? 'avatar-frame-speaking' : ''} ${isListening ? 'avatar-frame-listening' : ''}`}
      >
        <svg viewBox="0 0 200 240" className="avatar-svg" aria-hidden="true">
          <defs>
            <linearGradient id="skinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f5c9a8" />
              <stop offset="100%" stopColor="#e8a882" />
            </linearGradient>
            <linearGradient id="hairGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2c1810" />
              <stop offset="100%" stopColor="#4a2c1a" />
            </linearGradient>
            <linearGradient id="blazerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0f2744" />
            </linearGradient>
            <linearGradient id="bgCircle" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          <circle cx="100" cy="105" r="88" fill="url(#bgCircle)" />

          <ellipse cx="100" cy="200" rx="72" ry="48" fill="url(#blazerGrad)" />
          <path d="M 55 175 Q 100 155 145 175 L 145 240 L 55 240 Z" fill="#0f2744" />
          <path d="M 88 175 L 100 210 L 112 175" fill="#ffffff" opacity="0.9" />
          <ellipse cx="100" cy="178" rx="8" ry="5" fill="#c0392b" />

          <ellipse cx="100" cy="95" rx="52" ry="58" fill="url(#skinGrad)" />

          <path
            d="M 48 72 Q 55 25 100 22 Q 145 25 152 72 Q 140 48 100 42 Q 60 48 48 72"
            fill="url(#hairGrad)"
          />
          <path d="M 48 72 Q 42 85 45 100 L 55 88 Q 52 78 48 72" fill="url(#hairGrad)" />
          <path d="M 152 72 Q 158 85 155 100 L 145 88 Q 148 78 152 72" fill="url(#hairGrad)" />

          <ellipse cx="78" cy="92" rx="10" ry="7" fill="#ffffff" />
          <ellipse cx="122" cy="92" rx="10" ry="7" fill="#ffffff" />
          <circle cx="80" cy="93" r="5" fill="#2c1810" />
          <circle cx="124" cy="93" r="5" fill="#2c1810" />
          <circle cx="81" cy="91" r="1.5" fill="#ffffff" />
          <circle cx="125" cy="91" r="1.5" fill="#ffffff" />

          <path d="M 88 108 Q 100 115 112 108" stroke="#c4785a" strokeWidth="2" fill="none" strokeLinecap="round" />

          <ellipse cx="68" cy="105" rx="8" ry="5" fill="#e8a882" opacity="0.5" />
          <ellipse cx="132" cy="105" rx="8" ry="5" fill="#e8a882" opacity="0.5" />

          <g className={`avatar-mouth ${isSpeaking ? 'avatar-mouth-speaking' : ''}`}>
            <ellipse cx="100" cy="118" rx="14" ry="6" fill="#c0392b" opacity="0.85" />
            <ellipse cx="100" cy="116" rx="10" ry="3" fill="#ffffff" opacity="0.3" />
          </g>

          <ellipse cx="72" cy="78" rx="14" ry="8" fill="url(#hairGrad)" opacity="0.6" />
          <ellipse cx="128" cy="78" rx="14" ry="8" fill="url(#hairGrad)" opacity="0.6" />
        </svg>

        {isSpeaking && (
          <div className="voice-bars" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="avatar-meta">
        <strong>{agentName}</strong>
        <span className="avatar-role">Real Estate Advisor</span>
        <span
          className={`avatar-status ${isSpeaking ? 'avatar-status-speaking' : isListening ? 'avatar-status-listening' : ''}`}
        >
          <span className="avatar-status-dot" />
          {statusLabel}
        </span>
      </div>
    </div>
  )
}
