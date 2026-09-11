import { BaseClient } from './BaseClient'
import type { Episode, EpisodeDetailResponse } from '../Podcast'
import type { CreatePodcastInput, UpdatePodcastInput, SaveResult } from '../Admin'

function buildPodcastFormData(input: CreatePodcastInput | UpdatePodcastInput, slug?: string): FormData {
  const formData = new FormData()
  if (slug) formData.set('slug', slug)
  formData.set('title', input.title)
  formData.set('publishDate', input.publishDate)
  if (input.episodeNumber) formData.set('episodeNumber', String(input.episodeNumber))
  formData.set('duration', input.duration ?? '')
  formData.set('speakers', JSON.stringify((input.speakers ?? []).filter((s) => s.name.trim())))
  formData.set('body', input.body ?? '')
  if (input.audio) formData.set('audio', input.audio)
  if (input.coverImage) formData.set('coverImage', input.coverImage)
  return formData
}

export class PodcastClient extends BaseClient {
  list(): Promise<Episode[]> {
    return this.publicJson('/podcast')
  }

  get(slug: string): Promise<EpisodeDetailResponse | null> {
    return this.publicJsonOrNull(`/podcast/${slug}`)
  }

  create(input: CreatePodcastInput): Promise<SaveResult> {
    return this.authedJson('/admin/podcast', { method: 'POST', body: buildPodcastFormData(input) })
  }

  update(slug: string, input: UpdatePodcastInput): Promise<SaveResult> {
    return this.authedJson('/admin/podcast', { method: 'POST', body: buildPodcastFormData(input, slug) })
  }

  delete(slug: string): Promise<{ ok: true }> {
    return this.authedJson(`/admin/podcast/${slug}`, { method: 'DELETE' })
  }
}
