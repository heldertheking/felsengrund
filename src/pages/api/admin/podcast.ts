import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { verifySession } from '../../../lib/admin-auth'
import {
  getPodcastEpisode,
  putPodcastEpisode,
  putPodcastAudio,
  putPodcastImage,
  slugify,
  type PodcastData,
} from '../../../lib/admin-content'

export const prerender = false

export const POST: APIRoute = async ({ request }) => {
  const authenticated = await verifySession(request.headers.get('cookie'), env.ADMIN_UPLOAD_PASSWORD ?? '')
  if (!authenticated) return Response.json({ error: 'Nicht angemeldet.' }, { status: 401 })

  const formData = await request.formData()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return Response.json({ error: 'Titel fehlt.' }, { status: 400 })

  const publishDate = String(formData.get('publishDate') ?? '').trim()
  if (!publishDate) return Response.json({ error: 'Veröffentlichungsdatum fehlt.' }, { status: 400 })

  const slugField = formData.get('slug')
  const isEdit = typeof slugField === 'string' && slugField.length > 0
  const slug = isEdit ? (slugField as string) : slugify(title)
  if (!slug) return Response.json({ error: 'Titel ergibt keinen gültigen Slug.' }, { status: 400 })

  const existing = isEdit ? await getPodcastEpisode(env.STORAGE, slug) : null
  if (!isEdit) {
    const conflict = await getPodcastEpisode(env.STORAGE, slug)
    if (conflict) {
      return Response.json({ error: 'Eine Episode mit diesem Titel existiert bereits.' }, { status: 409 })
    }
  }

  const audioFile = formData.get('audio')
  let audioUrl = existing?.data.audioUrl
  if (audioFile instanceof File && audioFile.size > 0) {
    audioUrl = await putPodcastAudio(env.STORAGE, slug, audioFile)
  }
  if (!audioUrl) return Response.json({ error: 'Audiodatei fehlt.' }, { status: 400 })

  const data: PodcastData = { title, publishDate, audioUrl }

  const episodeNumberRaw = formData.get('episodeNumber')
  if (episodeNumberRaw) {
    const episodeNumber = Number(episodeNumberRaw)
    if (!Number.isNaN(episodeNumber)) data.episodeNumber = episodeNumber
  }

  const duration = formData.get('duration')
  if (duration) data.duration = String(duration)

  const coverImageFile = formData.get('coverImage')
  if (coverImageFile instanceof File && coverImageFile.size > 0) {
    data.coverImage = await putPodcastImage(env.STORAGE, slug, coverImageFile)
  } else if (existing?.data.coverImage) {
    data.coverImage = existing.data.coverImage
  }

  const body = String(formData.get('body') ?? '')

  await putPodcastEpisode(env.STORAGE, slug, data, body)

  return Response.json({ slug })
}
