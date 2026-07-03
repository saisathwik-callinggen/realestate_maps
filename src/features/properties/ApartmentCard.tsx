import type { Apartment } from '../properties/types'
import { TAG_CLASS } from '../properties/types'

type ApartmentCardProps = {
  apartment: Apartment
  selected: boolean
  onSelect: (apartment: Apartment) => void
}

export function ApartmentCard({ apartment, selected, onSelect }: ApartmentCardProps) {
  const tagClass = apartment.tag ? TAG_CLASS[apartment.tag] : 'tag-premium'

  return (
    <article
      className={`prop-list-card ${selected ? 'prop-list-card-selected' : ''}`}
      onClick={() => onSelect(apartment)}
    >
      <div className="prop-list-img-placeholder">
        <svg viewBox="0 0 100 80" className="prop-wireframe-svg">
          <rect x="10" y="30" width="24" height="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <rect x="38" y="15" width="28" height="55" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <rect x="70" y="40" width="22" height="30" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <line x1="0" y1="70" x2="100" y2="70" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          {selected && (
            <>
              <rect x="44" y="25" width="4" height="4" fill="#06b6d4" className="window-glow" />
              <rect x="58" y="35" width="4" height="4" fill="#8b5cf6" className="window-glow-delay" />
              <rect x="16" y="45" width="4" height="4" fill="#06b6d4" />
            </>
          )}
        </svg>
        {apartment.tag && <span className={`prop-tag-badge ${tagClass}`}>{apartment.tag}</span>}
      </div>

      <div className="prop-list-info">
        <div className="prop-list-row-first">
          <h4 className="prop-list-name">{apartment.name}</h4>
          <button type="button" className="prop-favorite-btn" aria-label="Favorite" onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <p className="prop-list-location">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {apartment.address}
        </p>
        <p className="prop-list-type">{apartment.bhk}</p>
        <strong className="prop-list-price">{apartment.price}</strong>
      </div>
    </article>
  )
}
