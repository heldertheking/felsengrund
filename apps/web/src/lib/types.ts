// Mirrors the shapes returned by apps/api (see packages/shared/src/admin-content.ts on the
// backend) — duplicated here rather than imported since apps/web has no dependency on the
// backend/shared package, it only ever talks to it over HTTP.

export interface OfferOrganizer {
  name: string
  role?: string
  contact?: string
}

export interface OfferData {
  title: string
  intro?: string
  cardImage?: string
  category: 'gottesdienst' | 'kinder-jugend' | 'gemeinschaft' | 'senioren' | 'hilfe-service'
  targetAudience?: string
  schedule?: string
  location?: string
  mapsLink?: string
  organizers?: OfferOrganizer[]
  registration?: string
}

export interface Offer {
  slug: string
  data: OfferData
  body: string
}

export interface OfferDetailResponse extends Offer {
  bodyHtml: string
}

export interface PodcastData {
  title: string
  episodeNumber?: number
  publishDate: string
  audioUrl: string
  duration?: string
  coverImage?: string
}

export interface PodcastEpisode {
  slug: string
  data: PodcastData
  body: string
}

export interface PodcastDetailResponse extends PodcastEpisode {
  bodyHtml: string
}

export const CATEGORY_ORDER = ['gottesdienst', 'kinder-jugend', 'gemeinschaft', 'senioren', 'hilfe-service'] as const

export const CATEGORY_LABELS: Record<string, string> = {
  gottesdienst: 'Gottesdienst',
  'kinder-jugend': 'Kinder & Jugend',
  gemeinschaft: 'Gemeinschaft',
  senioren: 'Senioren',
  'hilfe-service': 'Hilfe & Service',
}
