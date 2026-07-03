import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Apartment } from '../properties/types'
import { CITY_CENTERS } from './cityCenters'
import './PropertyMap.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

type PropertyMapProps = {
  city: string
  apartments: Apartment[]
  selectedApartment: Apartment | null
  zoomMode: 'overview' | 'property'
  onApartmentSelect: (apartment: Apartment) => void
}

function buildPopupHtml(apartment: Apartment): string {
  return `
    <div class="leaflet-popup-card">
      <strong>${apartment.name}</strong>
      <p class="popup-price">${apartment.price}</p>
      <p class="popup-address">${apartment.address}</p>
      <p class="popup-desc">${apartment.description}</p>
    </div>
  `
}

function fitMapToApartments(map: L.Map, apartments: Apartment[]) {
  if (apartments.length === 0) return

  if (apartments.length === 1) {
    const apt = apartments[0]
    map.flyTo([apt.latitude, apt.longitude], 14, { duration: 1.2 })
    return
  }

  const bounds = L.latLngBounds(
    apartments.map((apt) => [apt.latitude, apt.longitude] as [number, number]),
  )
  map.flyToBounds(bounds, { padding: [48, 48], duration: 1.2, maxZoom: 13 })
}

export function PropertyMap({
  city,
  apartments,
  selectedApartment,
  zoomMode,
  onApartmentSelect,
}: PropertyMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const onSelectRef = useRef(onApartmentSelect)
  onSelectRef.current = onApartmentSelect

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const center = CITY_CENTERS[city] ?? CITY_CENTERS.Pune
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([center.lat, center.lng], center.zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [])

  // Re-sync markers and show all points when city or apartment list changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current.clear()

    apartments.forEach((apartment) => {
      const marker = L.marker([apartment.latitude, apartment.longitude])
        .addTo(map)
        .bindPopup(buildPopupHtml(apartment), { maxWidth: 280, className: 'estate-popup' })

      marker.on('click', () => onSelectRef.current(apartment))
      markersRef.current.set(apartment.id, marker)
    })

    requestAnimationFrame(() => {
      map.invalidateSize()
      fitMapToApartments(map, apartments)
    })
  }, [city, apartments])

  // Zoom to a specific property when user picks one (card click or voice)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedApartment || zoomMode !== 'property') return

    const marker = markersRef.current.get(selectedApartment.id)
    if (!marker) return

    map.flyTo([selectedApartment.latitude, selectedApartment.longitude], 15, { duration: 1.5 })
    window.setTimeout(() => marker.openPopup(), 800)
  }, [selectedApartment, zoomMode])

  return <div ref={containerRef} className="property-leaflet-map" aria-label={`Map of ${city}`} />
}
