import type { Episode, EpisodeDetailResponse, Offer, OfferDetailResponse } from '@felsengrund/types';

export function makeOffer(overrides: Partial<Offer['data']> & { slug?: string; body?: string } = {}): Offer {
  const { slug = 'kinderstunde', body = 'Text', ...data } = overrides;
  return { slug, body, data: { title: 'Kinderstunde', category: 'kinder-jugend', ...data } };
}

export function makeOfferDetail(
  overrides: Partial<Offer['data']> & { slug?: string; bodyHtml?: string } = {},
): OfferDetailResponse {
  const { bodyHtml = '<p>Details</p>', ...rest } = overrides;
  return { ...makeOffer(rest), bodyHtml };
}

export function makeEpisode(overrides: Partial<Episode['data']> & { slug?: string; body?: string } = {}): Episode {
  const { slug = 'folge-1', body = 'Notizen', ...data } = overrides;
  return {
    slug,
    body,
    data: { title: 'Folge 1', publishDate: '2026-02-01', audioUrl: 'http://api.test/media/a.mp3', ...data },
  };
}

export function makeEpisodeDetail(
  overrides: Partial<Episode['data']> & { slug?: string; bodyHtml?: string } = {},
): EpisodeDetailResponse {
  const { bodyHtml = '<p>Shownotes</p>', ...rest } = overrides;
  return { ...makeEpisode(rest), bodyHtml };
}
