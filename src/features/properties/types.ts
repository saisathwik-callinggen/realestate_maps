export type ApartmentTag = 'Premium' | 'Best Value' | 'Luxury'

export type Apartment = {
  id: string
  name: string
  price: string
  bhk: string
  address: string
  description: string
  city: string
  locality: string
  latitude: number
  longitude: number
  tag?: ApartmentTag
}

export type ApartmentsResponse = {
  city: string | null
  apartments: Apartment[]
  count: number
}

export const TAG_CLASS: Record<ApartmentTag, string> = {
  Premium: 'tag-premium',
  'Best Value': 'tag-value',
  Luxury: 'tag-luxury',
}
