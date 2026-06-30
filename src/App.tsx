import { useRef, useState } from 'react'
import './App.css'

const capabilityCards = [
  {
    title: 'Voice-led lead capture',
    description:
      'Answer property questions, qualify intent, and move the conversation toward a booking without making the buyer fill out forms.',
  },
  {
    title: 'Location-aware search',
    description:
      'Search by neighborhood, landmark, budget, or commute radius and surface the right projects on the map instantly.',
  },
  {
    title: 'Site visit scheduling',
    description:
      'Offer available slots, confirm contact details, and hand off a ready-to-close booking to your sales team.',
  },
]

const flowSteps = [
  'Buyer asks for a project near a landmark or office location.',
  'The agent narrows options on the map and recommends matching inventory.',
  'A visit slot is locked in and the lead is pushed to the CRM or sales desk.',
]

const trustPoints = [
  'Multilingual voice support',
  'Live map context',
  'Booked visit handoff',
  'Lead qualification summary',
]

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    setTranscript('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        setIsRecording(false)
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await sendAudioToStt(audioBlob)
      }

      recorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Microphone access failed', error)
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const sendAudioToStt = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio_file', audioBlob, 'recording.webm')

    try {
      const response = await fetch('http://localhost:8000/soravm/stt', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        console.error('STT request failed', response.status)
        const error = await response.text()
        setTranscript(`Error: ${error}`)
        return
      }

      const json = await response.json()
      setTranscript(json.text || JSON.stringify(json))
    } catch (error) {
      console.error('STT request error', error)
      setTranscript('Speech-to-text failed')
    }
  }

  return (
    <div className="landing-page">
      <div className="ambient ambient-left" aria-hidden="true" />
      <div className="ambient ambient-right" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark">YA</div>
          <div>
            <p className="brand-name">Yohita AI</p>
            <p className="brand-tag">Smart site visit assistant</p>
          </div>
        </div>

        <nav className="topnav" aria-label="Primary">
          <a href="#capabilities">Capabilities</a>
          <a href="#flow">Flow</a>
          <a href="#demo">Demo</a>
        </nav>

        <div className="header-actions">
          <button className="header-cta" type="button" onClick={startRecording} disabled={isRecording}>
            {isRecording ? 'Recording...' : 'Request a demo'}
          </button>
          {isRecording && (
            <button className="secondary-cta" type="button" onClick={stopRecording}>
              Stop recording
            </button>
          )}
        </div>
      </header>

      <main>
        <section className="hero" id="demo">
          <div className="hero-copy">
            <span className="eyebrow">Real estate voice agent</span>
            <h1>Book site visits faster with a voice-first property concierge.</h1>
            <p className="hero-text">
              Let buyers describe what they want in natural language. The agent
              searches the map, surfaces matching projects, qualifies the lead,
              and books the visit in one conversation.
            </p>

            <div className="cta-row">
              <a className="primary-cta" href="#flow">
                See the booking flow
              </a>
              <a className="secondary-cta" href="#capabilities">
                Explore capabilities
              </a>
            </div>

            <div className="trust-row" aria-label="Key benefits">
              {trustPoints.map((point) => (
                <span key={point} className="trust-pill">
                  {point}
                </span>
              ))}
            </div>

            <div className="speech-output">
              <p className="speech-label">Transcript</p>
              <div className="speech-box">
                {transcript ? transcript : 'Speak using the Request a demo button and stop recording when finished.'}
              </div>
            </div>

            <div className="stats-grid" aria-label="Highlights">
              <article>
                <strong>Live map search</strong>
                <span>Filter projects by area, landmark, commute, or budget.</span>
              </article>
              <article>
                <strong>Instant booking</strong>
                <span>Move from inquiry to confirmed site visit without delay.</span>
              </article>
              <article>
                <strong>CRM ready</strong>
                <span>Every conversation ends with a structured lead summary.</span>
              </article>
            </div>
          </div>

          <div className="hero-console">
            <div className="console-card console-avatar">
              <div className="avatar-ring" aria-hidden="true">
                <div className="avatar-core">YA</div>
              </div>
              <div>
                <p className="console-label">Voice assistant status</p>
                <h2>Speaking with a buyer now</h2>
                <p>
                  Guiding the user through neighborhoods, inventory, and visit
                  timing in a single flow.
                </p>
              </div>
              <div className="waveform" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="console-card map-card" aria-label="Property map preview">
              <div className="map-toolbar">
                <span>Search location, project, or landmark</span>
                <span className="map-live">Live</span>
              </div>

              <div className="map-surface" aria-hidden="true">
                <div className="grid-lines" />
                <span className="map-pin pin-one" />
                <span className="map-pin pin-two" />
                <span className="map-pin pin-three" />
                <div className="map-card-overlay">
                  <p>Hinjewadi Tech Heights</p>
                  <span>2 BHK smart homes, available visits this week</span>
                </div>
              </div>

              <div className="map-footer">
                <div>
                  <strong>Nearby matches</strong>
                  <span>3 projects in the 3 km radius</span>
                </div>
                <button type="button">Book a visit</button>
              </div>
            </div>
          </div>
        </section>

        <section className="capabilities" id="capabilities">
          {capabilityCards.map((card) => (
            <article key={card.title} className="capability-card">
              <div className="capability-dot" aria-hidden="true" />
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </section>

        <section className="flow-section" id="flow">
          <div className="section-heading">
            <span className="eyebrow">Booking flow</span>
            <h2>From voice query to confirmed site visit.</h2>
          </div>

          <div className="flow-grid">
            {flowSteps.map((step, index) => (
              <article key={step} className="flow-step">
                <span className="step-index">0{index + 1}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
