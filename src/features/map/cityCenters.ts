export const CITY_CENTERS: Record<string, { lat: number; lng: number; zoom: number }> = {
  Pune: { lat: 18.5204, lng: 73.8567, zoom: 12 },
  Mumbai: { lat: 19.076, lng: 72.8777, zoom: 11 },
  Delhi: { lat: 28.49, lng: 77.2, zoom: 11 },
  Hyderabad: { lat: 17.385, lng: 78.4867, zoom: 12 },
}

export const SUPPORTED_CITIES = Object.keys(CITY_CENTERS)
