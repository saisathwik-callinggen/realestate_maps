import { useEffect, useState } from 'react'
import type { Apartment } from './types'
import { fetchApartmentsByCity } from './api'

export function useApartments(city: string) {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetchApartmentsByCity(city)
      .then((data) => {
        if (active) {
          setApartments(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load apartments')
          setLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [city])

  return { apartments, loading, error }
}
