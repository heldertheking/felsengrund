import { Hono } from 'hono'
import type { MiddlewareHandler } from 'hono'
import {
  createSessionToken,
  deleteOffer,
  deletePodcastEpisode,
  getOffer,
  getPodcastEpisode,
  parseBearerToken,
  putOffer,
  putOfferImage,
  putPodcastAudio,
  putPodcastEpisode,
  putPodcastImage,
  slugify,
  verifySessionToken,
} from '@felsengrund/api-core'
import { CATEGORY_DETAILS, type OfferFrontmatter, type OfferOrganizer, type EpisodeFrontmatter } from '@felsengrund/types'
import { createLogger } from '@felsengrund/logger'
import type { Env } from '../types'

export const adminRoute = new Hono<{ Bindings: Env }>()

const logger = createLogger('admin')

const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = parseBearerToken(c.req.header('authorization'))
  const authenticated = await verifySessionToken(token, c.env.ADMIN_UPLOAD_PASSWORD ?? '')
  if (!authenticated) return c.json({ error: 'Nicht angemeldet.' }, 401)
  await next()
}

adminRoute.post('/admin/login', async (c) => {
  const formData = await c.req.formData()
  const password = formData.get('password')

  if (typeof password !== 'string' || !c.env.ADMIN_UPLOAD_PASSWORD || password !== c.env.ADMIN_UPLOAD_PASSWORD) {
    return c.json({ error: 'Falsches Passwort.' }, 401)
  }

  const token = await createSessionToken(password)
  return c.json({ token })
})

// Stateless bearer tokens can't be revoked server-side; the frontend just discards its stored
// token. Kept as a real endpoint for symmetry with the old cookie-based flow and in case a
// revocation list is added later.
adminRoute.post('/admin/logout', async (c) => c.json({ ok: true }))

adminRoute.use('/admin/offers', requireAuth)
adminRoute.use('/admin/offers/*', requireAuth)
adminRoute.use('/admin/podcast', requireAuth)
adminRoute.use('/admin/podcast/*', requireAuth)

const VALID_CATEGORIES = Object.keys(CATEGORY_DETAILS) as OfferFrontmatter['category'][]

adminRoute.post('/admin/offers', async (c) => {
  const formData = await c.req.formData()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return c.json({ error: 'Titel fehlt.' }, 400)

  const category = String(formData.get('category') ?? '')
  if (!VALID_CATEGORIES.includes(category as OfferFrontmatter['category'])) {
    return c.json({ error: 'Ungültige Kategorie.' }, 400)
  }

  const slugField = formData.get('slug')
  const isEdit = typeof slugField === 'string' && slugField.length > 0
  const slug = isEdit ? (slugField as string) : slugify(title)
  if (!slug) return c.json({ error: 'Titel ergibt keinen gültigen Slug.' }, 400)

  const existing = isEdit ? await getOffer(c.env.STORAGE, slug) : null
  if (!isEdit) {
    const conflict = await getOffer(c.env.STORAGE, slug)
    if (conflict) {
      return c.json({ error: 'Ein Angebot mit diesem Titel existiert bereits.' }, 409)
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

  const data: OfferFrontmatter = { title, category: category as OfferFrontmatter['category'] }

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
  if (cardImageFile && typeof cardImageFile !== 'string') {
    logger.info('cardImage field present', {
      slug,
      name: cardImageFile.name,
      size: cardImageFile.size,
      type: cardImageFile.type,
    })
  } else {
    logger.info('no cardImage field in formData', { slug, keys: [...formData.keys()] })
  }

  if (cardImageFile && typeof cardImageFile !== 'string' && cardImageFile.size > 0) {
    try {
      data.cardImage = await putOfferImage(c.env.STORAGE, slug, cardImageFile)
      logger.info('stored cardImage', { slug, cardImage: data.cardImage })
    } catch (error) {
      logger.error('failed to store cardImage', { slug, error })
      throw error
    }
  } else if (existing?.data.cardImage) {
    data.cardImage = existing.data.cardImage
  }

  const body = String(formData.get('body') ?? '')

  try {
    await putOffer(c.env.STORAGE, slug, data, body)
    logger.info('stored offer', { slug })
  } catch (error) {
    logger.error('failed to store offer', { slug, error })
    throw error
  }

  return c.json({ slug })
})

adminRoute.delete('/admin/offers/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!slug) return c.json({ error: 'Fehlender Slug.' }, 400)

  await deleteOffer(c.env.STORAGE, slug)

  return c.json({ ok: true })
})

adminRoute.post('/admin/podcast', async (c) => {
  const formData = await c.req.formData()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return c.json({ error: 'Titel fehlt.' }, 400)

  const publishDate = String(formData.get('publishDate') ?? '').trim()
  if (!publishDate) return c.json({ error: 'Veröffentlichungsdatum fehlt.' }, 400)

  const slugField = formData.get('slug')
  const isEdit = typeof slugField === 'string' && slugField.length > 0
  const slug = isEdit ? (slugField as string) : slugify(title)
  if (!slug) return c.json({ error: 'Titel ergibt keinen gültigen Slug.' }, 400)

  const existing = isEdit ? await getPodcastEpisode(c.env.STORAGE, slug) : null
  if (!isEdit) {
    const conflict = await getPodcastEpisode(c.env.STORAGE, slug)
    if (conflict) {
      return c.json({ error: 'Eine Episode mit diesem Titel existiert bereits.' }, 409)
    }
  }

  const audioFile = formData.get('audio')
  if (audioFile && typeof audioFile !== 'string') {
    logger.info('audio field present', {
      slug,
      name: audioFile.name,
      size: audioFile.size,
      type: audioFile.type,
    })
  } else {
    logger.info('no audio field in formData', { slug, keys: [...formData.keys()] })
  }

  let audioUrl = existing?.data.audioUrl
  if (audioFile && typeof audioFile !== 'string' && audioFile.size > 0) {
    try {
      audioUrl = await putPodcastAudio(c.env.STORAGE, slug, audioFile)
      logger.info('stored audio', { slug, audioUrl })
    } catch (error) {
      logger.error('failed to store audio', { slug, error })
      throw error
    }
  }
  if (!audioUrl) return c.json({ error: 'Audiodatei fehlt.' }, 400)

  const data: EpisodeFrontmatter = { title, publishDate, audioUrl }

  const episodeNumberRaw = formData.get('episodeNumber')
  if (episodeNumberRaw) {
    const episodeNumber = Number(episodeNumberRaw)
    if (!Number.isNaN(episodeNumber)) data.episodeNumber = episodeNumber
  }

  const duration = formData.get('duration')
  if (duration) data.duration = String(duration)

  const coverImageFile = formData.get('coverImage')
  if (coverImageFile && typeof coverImageFile !== 'string' && coverImageFile.size > 0) {
    try {
      data.coverImage = await putPodcastImage(c.env.STORAGE, slug, coverImageFile)
      logger.info('stored coverImage', { slug, coverImage: data.coverImage })
    } catch (error) {
      logger.error('failed to store coverImage', { slug, error })
      throw error
    }
  } else if (existing?.data.coverImage) {
    data.coverImage = existing.data.coverImage
  }

  const body = String(formData.get('body') ?? '')

  try {
    await putPodcastEpisode(c.env.STORAGE, slug, data, body)
    logger.info('stored episode', { slug })
  } catch (error) {
    logger.error('failed to store episode', { slug, error })
    throw error
  }

  return c.json({ slug })
})

adminRoute.delete('/admin/podcast/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!slug) return c.json({ error: 'Fehlender Slug.' }, 400)

  await deletePodcastEpisode(c.env.STORAGE, slug)

  return c.json({ ok: true })
})
