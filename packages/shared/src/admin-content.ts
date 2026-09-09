import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import Markdoc from '@markdoc/markdoc'

// Shared R2-backed content store for offers and podcast episodes. Each entry is a single R2
// object at `<offers|podcast>/<slug>.mdoc`: YAML frontmatter followed by the Markdoc body.
//
// Images live at `images/offers/<slug>.<ext>` / `images/podcast/<slug>.<ext>`, and podcast audio
// at `podcast/<slug>.<ext>` — sharing the entry's slug as the filename (minus extension) so an
// episode's mdoc, audio, and cover image are easy to spot together in the bucket.

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

export interface PodcastData {
  title: string
  episodeNumber?: number
  publishDate: string // ISO date (YYYY-MM-DD)
  audioUrl: string
  duration?: string
  coverImage?: string
}

export interface PodcastEpisode {
  slug: string
  data: PodcastData
  body: string
}

const OFFERS_PREFIX = 'offers/'
const PODCAST_PREFIX = 'podcast/'
const OFFER_IMAGES_PREFIX = 'images/offers/'
const PODCAST_IMAGES_PREFIX = 'images/podcast/'

function splitFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { data: {}, body: raw.trim() }
  return { data: (parseYaml(match[1]) ?? {}) as Record<string, unknown>, body: match[2].trim() }
}

function joinFrontmatter(data: Record<string, unknown>, body: string): string {
  const yaml = stringifyYaml(data, { lineWidth: 0 }).trim()
  return `---\n${yaml}\n---\n\n${body.trim()}\n`
}

async function listMdocSlugs(storage: R2Bucket, prefix: string): Promise<string[]> {
  const result = await storage.list({ prefix })
  return result.objects
    .filter((object) => object.key.endsWith('.mdoc'))
    .map((object) => object.key.slice(prefix.length, -'.mdoc'.length))
}

export async function listOffers(storage: R2Bucket): Promise<Offer[]> {
  const slugs = await listMdocSlugs(storage, OFFERS_PREFIX)
  const offers = await Promise.all(slugs.map((slug) => getOffer(storage, slug)))
  return offers.filter((offer): offer is Offer => offer !== null)
}

export async function getOffer(storage: R2Bucket, slug: string): Promise<Offer | null> {
  const object = await storage.get(`${OFFERS_PREFIX}${slug}.mdoc`)
  if (!object) return null
  const { data, body } = splitFrontmatter(await object.text())
  return { slug, data: data as unknown as OfferData, body }
}

export async function putOffer(storage: R2Bucket, slug: string, data: OfferData, body: string): Promise<void> {
  await storage.put(`${OFFERS_PREFIX}${slug}.mdoc`, joinFrontmatter(data as unknown as Record<string, unknown>, body), {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })
}

export async function deleteOffer(storage: R2Bucket, slug: string): Promise<void> {
  await storage.delete(`${OFFERS_PREFIX}${slug}.mdoc`)
}

export async function listPodcastEpisodes(storage: R2Bucket): Promise<PodcastEpisode[]> {
  const slugs = await listMdocSlugs(storage, PODCAST_PREFIX)
  const episodes = await Promise.all(slugs.map((slug) => getPodcastEpisode(storage, slug)))
  return episodes.filter((episode): episode is PodcastEpisode => episode !== null)
}

export async function getPodcastEpisode(storage: R2Bucket, slug: string): Promise<PodcastEpisode | null> {
  const object = await storage.get(`${PODCAST_PREFIX}${slug}.mdoc`)
  if (!object) return null
  const { data, body } = splitFrontmatter(await object.text())
  return { slug, data: data as unknown as PodcastData, body }
}

export async function putPodcastEpisode(
  storage: R2Bucket,
  slug: string,
  data: PodcastData,
  body: string,
): Promise<void> {
  await storage.put(`${PODCAST_PREFIX}${slug}.mdoc`, joinFrontmatter(data as unknown as Record<string, unknown>, body), {
    httpMetadata: { contentType: 'text/markdown; charset=utf-8' },
  })
}

export async function deletePodcastEpisode(storage: R2Bucket, slug: string): Promise<void> {
  await storage.delete(`${PODCAST_PREFIX}${slug}.mdoc`)
}

// Podcast audio lives alongside the mdoc under the same prefix, e.g. `podcast/<slug>.mp3`.
// Served through apps/api's /media/* route, which reads the same STORAGE binding — so the
// returned key is a relative `/media/...` path that the API layer rewrites to an absolute URL
// before it reaches the frontend (see apps/api/src/lib/media-url.ts).
export async function putPodcastAudio(storage: R2Bucket, slug: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
  const key = `${PODCAST_PREFIX}${slug}.${ext}`
  await storage.put(key, file, { httpMetadata: { contentType: file.type || 'audio/mpeg' } })
  return `/media/${key}`
}

async function putImage(storage: R2Bucket, prefix: string, slug: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const key = `${prefix}${slug}.${ext}`
  await storage.put(key, file, { httpMetadata: { contentType: file.type || 'application/octet-stream' } })
  return `/media/${key}`
}

export function putOfferImage(storage: R2Bucket, slug: string, file: File): Promise<string> {
  return putImage(storage, OFFER_IMAGES_PREFIX, slug, file)
}

export function putPodcastImage(storage: R2Bucket, slug: string, file: File): Promise<string> {
  return putImage(storage, PODCAST_IMAGES_PREFIX, slug, file)
}

export function renderMarkdoc(source: string): string {
  const ast = Markdoc.parse(source)
  const content = Markdoc.transform(ast)
  return Markdoc.renderers.html(content)
}

const UMLAUTS: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => UMLAUTS[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
