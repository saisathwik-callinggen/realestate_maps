import type { Apartment } from './types'

export const CITY_KEYWORDS: Record<string, string> = {
  pune: 'Pune',
  mumbai: 'Mumbai',
  delhi: 'Delhi',
  'new delhi': 'Delhi',
  hyderabad: 'Hyderabad',
  gurugram: 'Delhi',
  gurgaon: 'Delhi',
  ncr: 'Delhi',
}

export function detectCityFromText(text: string): string | null {
  const lower = text.toLowerCase()
  const sorted = Object.entries(CITY_KEYWORDS).sort((a, b) => b[0].length - a[0].length)
  for (const [keyword, city] of sorted) {
    if (lower.includes(keyword)) return city
  }
  return null
}

function apartmentMatchScore(text: string, apartment: Apartment): number {
  const lower = text.toLowerCase()
  const nameLower = apartment.name.toLowerCase()
  const localityLower = apartment.locality.toLowerCase()
  let score = 0

  if (lower.includes(nameLower)) score += 100

  const nameParts = nameLower.split(/[\s&]+/).filter((w) => w.length > 2)
  for (const part of nameParts) {
    if (lower.includes(part)) score += 20
  }

  if (lower.includes(localityLower)) score += 30

  const addressLower = apartment.address.toLowerCase()
  if (lower.includes(addressLower)) score += 40

  return score
}

export function matchApartmentFromText(text: string, apartments: Apartment[]): Apartment | null {
  if (!text.trim() || apartments.length === 0) return null

  let best: Apartment | null = null
  let bestScore = 0

  for (const apartment of apartments) {
    const score = apartmentMatchScore(text, apartment)
    if (score > bestScore) {
      bestScore = score
      best = apartment
    }
  }

  return bestScore >= 20 ? best : null
}
