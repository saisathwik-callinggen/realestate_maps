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
}: SpeakingAvatarProps) {
  // Determine status label and color
  let statusText = 'Standby'
  let statusClass = 'status-idle'
  
  if (isListening) {
    statusText = 'Listening...'
    statusClass = 'status-listening'
  } else if (isProcessing) {
    statusText = 'Thinking...'
    statusClass = 'status-thinking'
  } else if (isSpeaking) {
    statusText = 'Speaking'
    statusClass = 'status-speaking'
  }

  return (
    <div className="avatar-wrapper">
      <div className="avatar-circle-container">
        <img 
          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=500&h=500&fit=crop" 
          alt="AI Assistant" 
          className={`avatar-image ${isSpeaking ? 'avatar-speaking-anim' : ''}`}
        />
        <div className={`avatar-status-badge ${statusClass}`}>
          <span className="status-dot"></span>
          {statusText}
        </div>
      </div>
    </div>
  )
}
