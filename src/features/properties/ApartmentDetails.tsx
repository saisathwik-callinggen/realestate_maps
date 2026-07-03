import type { Apartment } from './types'
import { TAG_CLASS } from './types'

type ApartmentDetailsProps = {
  apartment: Apartment | null
}

export function ApartmentDetails({ apartment }: ApartmentDetailsProps) {
  if (!apartment) return null

  const tagClass = apartment.tag ? TAG_CLASS[apartment.tag] : 'tag-premium'

  return (
    <div className="apartment-details-panel">
      <div className="apartment-details-header">
        <h4>{apartment.name}</h4>
        {apartment.tag && <span className={`prop-tag-badge ${tagClass}`}>{apartment.tag}</span>}
      </div>
      <p className="apartment-details-price">{apartment.price}</p>
      <div className="apartment-details-meta">
        <span>{apartment.bhk}</span>
        <span className="apartment-details-dot">•</span>
        <span>{apartment.locality}, {apartment.city}</span>
      </div>
      <p className="apartment-details-address">{apartment.address}</p>
      <p className="apartment-details-description">{apartment.description}</p>
    </div>
  )
}
