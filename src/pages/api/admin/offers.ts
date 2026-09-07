import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { verifySession } from '../../../lib/admin-auth'
import { getOffer, putOffer, putOfferImage, slugify, type OfferData, type OfferOrganizer } from '../../../lib/admin-content'

export const prerender = false

const VALID_CATEGORIES: OfferData['category'][] = [
  'gottesdienst',
  'kinder-jugend',
  'gemeinschaft',
  'senioren',
  'hilfe-service',
]

export const POST: APIRoute = async ({ request }) => {
  const authenticated = await verifySession(request.headers.get('cookie'), env.ADMIN_UPLOAD_PASSWORD ?? '')
  if (!authenticated) return Response.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const formData = await request.formData()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return Response.json({ error: 'Titel fehlt.' }, { status: 400 })

  const category = String(formData.get('category') ?? '')
  if (!VALID_CATEGORIES.includes(category as OfferData['category'])) {
    return Response.json({ error: 'Ungültige Kategorie.' }, { status: 400 })
  }

  const slugField = formData.get('slug')
  const isEdit = typeof slugField === 'string' && slugField.length > 0
  const slug = isEdit ? (slugField as string) : slugify(title)
  if (!slug) return Response.json({ error: 'Titel ergibt keinen gültigen Slug.' }, { status: 400 })

  const existing = isEdit ? await getOffer(env.STORAGE, slug) : null
  if (!isEdit) {
    const conflict = await getOffer(env.STORAGE, slug)
    if (conflict) {
      return Response.json({ error: 'Ein Angebot mit diesem Titel existiert bereits.' }, { status: 409 })
    }
  }

  const organizersRaw = formData.get('organizers')
  let organizers: OfferOrganizer[] = []
  if (typeof organizersRaw === 'string' && organizersRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(organizersRaw)
      if (Array.isArray(parsed)) organizers = parsed
    } catch {
      organizers = []
    }
  }

  const data: OfferData = { title, category: category as OfferData['category'] }

  const intro = formData.get('intro')
  if (intro) data.intro = String(intro)
  const targetAudience = formData.get('targetAudience')
  if (targetAudience) data.targetAudience = String(targetAudience)
  const schedule = formData.get('schedule')
  if (schedule) data.schedule = String(schedule)
  const location = formData.get('location')
  if (location) data.location = String(location)
  const mapsLink = formData.get('mapsLink')
  if (mapsLink) data.mapsLink = String(mapsLink)
  const registration = formData.get('registration')
  if (registration) data.registration = String(registration)
  if (organizers.length > 0) data.organizers = organizers

  const cardImageFile = formData.get('cardImage')
  if (cardImageFile instanceof File && cardImageFile.size > 0) {
    data.cardImage = await putOfferImage(env.STORAGE, slug, cardImageFile)
  } else if (existing?.data.cardImage) {
    data.cardImage = existing.data.cardImage
  }

  const body = String(formData.get('body') ?? '')

  await putOffer(env.STORAGE, slug, data, body)

  return Response.json({ slug })
}
