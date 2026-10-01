/**
 * Builds the multipart `form` bodies for the admin save endpoints. The return types are checked
 * against the API's own schemas (through the typed client in `./api`), so renaming or retyping a
 * field in `apps/api/src/routes/admin.ts` breaks the build here instead of failing at runtime.
 */

import type { CreateOfferInput, CreatePodcastInput, UpdateOfferInput, UpdatePodcastInput } from '@felsengrund/types';

export function offerForm(input: CreateOfferInput | UpdateOfferInput, slug?: string) {
  return {
    ...(slug ? { slug } : {}),
    title: input.title,
    intro: input.intro ?? '',
    category: input.category,
    targetAudience: input.targetAudience ?? '',
    schedule: input.schedule ?? '',
    location: input.location ?? '',
    mapsLink: input.mapsLink ?? '',
    googleMapsIframeLink: input.googleMapsIframeLink ?? '',
    registration: input.registration ?? '',
    organizers: JSON.stringify((input.organizers ?? []).filter((o) => o.name.trim())),
    body: input.body ?? '',
    ...(input.cardImage ? { cardImage: input.cardImage } : {}),
  };
}

export function podcastForm(input: CreatePodcastInput | UpdatePodcastInput, slug?: string) {
  return {
    ...(slug ? { slug } : {}),
    title: input.title,
    publishDate: input.publishDate,
    ...(input.episodeNumber ? { episodeNumber: String(input.episodeNumber) } : {}),
    duration: input.duration ?? '',
    speakers: JSON.stringify((input.speakers ?? []).filter((s) => s.name.trim())),
    body: input.body ?? '',
    ...(input.audio ? { audio: input.audio } : {}),
    ...(input.coverImage ? { coverImage: input.coverImage } : {}),
  };
}
