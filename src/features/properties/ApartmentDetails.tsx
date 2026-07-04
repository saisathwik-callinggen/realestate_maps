import type { Apartment } from './types'

type ApartmentDetailsProps = {
  apartment: Apartment | null
}

export function ApartmentDetails({ apartment }: ApartmentDetailsProps) {
  if (!apartment) return null

  // Hardcode an image based on the apartment or just use a generic placeholder for the new UI
  const propertyImage = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80"
  const possessionDate = "Dec 2026"

  return (
    <div className="property-details-panel" style={{height: '100%'}}>
      <img src={propertyImage} alt={apartment.name} className="property-image" />
      <div className="property-content">
        <h3 className="property-title">{apartment.name}</h3>
        <div className="property-subtitle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
            <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
            <line x1="9" y1="6" x2="9" y2="6"/>
            <line x1="15" y1="6" x2="15" y2="6"/>
            <line x1="9" y1="10" x2="9" y2="10"/>
            <line x1="15" y1="10" x2="15" y2="10"/>
            <line x1="9" y1="14" x2="9" y2="14"/>
            <line x1="15" y1="14" x2="15" y2="14"/>
            <line x1="9" y1="18" x2="9" y2="18"/>
            <line x1="15" y1="18" x2="15" y2="18"/>
          </svg>
          {apartment.tag ? `LuxeLiving Group - ${apartment.tag}` : 'LuxeLiving Group'}
        </div>
        <div className="property-price">{apartment.price}</div>
        
        <div className="property-specs">
          <div className="spec-row">
            <span className="spec-label">Configuration</span>
            <span className="spec-value">{apartment.bhk}<br/>Apartment</span>
          </div>
          <div className="spec-row">
            <span className="spec-label">Possession</span>
            <span className="spec-value">{possessionDate}</span>
          </div>
        </div>

        <div className="amenities-section">
          <h4>AMENITIES</h4>
          <div className="amenities-list">
            <span className="amenity-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg> Club House</span>
            <span className="amenity-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M18 20V10M12 20V4M6 20v-6"/></svg> Gym</span>
            <span className="amenity-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M23 12h-4l-3 9L9 3l-3 9H2"/></svg> EV Charging</span>
            <span className="amenity-pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12"><path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> Infinity Pool</span>
          </div>
        </div>

        <div className="action-buttons">
          <button className="btn-primary">Book Site Visit</button>
          <button className="btn-secondary">Send Brochure</button>
        </div>

        <div className="footer-links">
          <a href="#" className="footer-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            WhatsApp
          </a>
          <a href="#" className="footer-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            Call Advisor
          </a>
        </div>
      </div>
    </div>
  )
}
