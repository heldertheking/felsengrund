import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ADMIN_PASSWORD, API_URL, WEB_URL } from '../env.mjs';

const fixtures = new URL('../fixtures/', import.meta.url);
const imageUrl = new URL('card.png', fixtures);
const audioUrl = new URL('episode.mp3', fixtures);

/** Paths of the small fixture files, for `setInputFiles`. */
export const imageFixturePath = fileURLToPath(imageUrl);
export const audioFixturePath = fileURLToPath(audioUrl);

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  // The Origin header is what the Worker's CORS allowlist checks; browsers send it, Node does not.
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Origin: WEB_URL, ...init.headers },
  });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path} failed with ${response.status}`);
  return response;
}

export async function login(password = ADMIN_PASSWORD): Promise<string> {
  const form = new FormData();
  form.set('password', password);
  const { token } = (await (await call('/admin/login', { method: 'POST', body: form })).json()) as { token: string };
  return token;
}

async function fixtureFile(url: URL, name: string, type: string): Promise<File> {
  return new File([await readFile(url)], name, { type });
}

export interface OfferSeed {
  title: string;
  category: string;
  intro?: string;
  schedule?: string;
  location?: string;
  targetAudience?: string;
  registration?: string;
  organizers?: { name: string; role?: string; contact?: string }[];
  body?: string;
  withImage?: boolean;
}

/** Creates an offer through the admin API and returns its slug. */
export async function createOffer(token: string, seed: OfferSeed): Promise<string> {
  const form = new FormData();
  form.set('title', seed.title);
  form.set('category', seed.category);
  for (const key of ['intro', 'schedule', 'location', 'targetAudience', 'registration', 'body'] as const) {
    const value = seed[key];
    if (value) form.set(key, value);
  }
  if (seed.organizers) form.set('organizers', JSON.stringify(seed.organizers));
  if (seed.withImage) form.set('cardImage', await fixtureFile(imageUrl, 'card.png', 'image/png'));
  const response = await call('/admin/offers', {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((await response.json()) as { slug: string }).slug;
}

export interface EpisodeSeed {
  title: string;
  publishDate: string;
  episodeNumber?: number;
  duration?: string;
  speakers?: { name: string; main?: boolean }[];
  body?: string;
}

/** Creates a podcast episode (with the audio fixture) through the admin API and returns its slug. */
export async function createEpisode(token: string, seed: EpisodeSeed): Promise<string> {
  const form = new FormData();
  form.set('title', seed.title);
  form.set('publishDate', seed.publishDate);
  if (seed.episodeNumber) form.set('episodeNumber', String(seed.episodeNumber));
  if (seed.duration) form.set('duration', seed.duration);
  if (seed.body) form.set('body', seed.body);
  form.set('speakers', JSON.stringify(seed.speakers ?? []));
  form.set('audio', await fixtureFile(audioUrl, 'episode.mp3', 'audio/mpeg'));
  const response = await call('/admin/podcast', {
    method: 'POST',
    body: form,
    headers: { Authorization: `Bearer ${token}` },
  });
  return ((await response.json()) as { slug: string }).slug;
}

/** Removes test data again; a missing item is not an error. */
export async function deleteContent(kind: 'offers' | 'podcast', slug: string): Promise<void> {
  const token = await login();
  await fetch(`${API_URL}/admin/${kind}/${slug}`, {
    method: 'DELETE',
    headers: { Origin: WEB_URL, Authorization: `Bearer ${token}` },
  });
}

/** Content every public-page test can rely on; created by the global setup. */
export const SEED = {
  offer: {
    title: 'E2E Seed Angebot',
    slug: 'e2e-seed-angebot',
    category: 'gemeinschaft',
    categoryLabel: 'Gemeinschaft',
    intro: 'Ein Angebot nur für die automatischen Tests.',
    schedule: 'Jeden Mittwoch, 19:00 Uhr',
    location: 'Testsaal 1',
    targetAudience: 'Alle Testpersonen',
    registration: 'Keine Anmeldung nötig',
    organizer: { name: 'Erika Testfrau', role: 'Leitung', contact: 'erika@example.invalid' },
    bodyText: 'Willkommen zum Seed-Angebot.',
  },
  episode: {
    title: 'E2E Seed Predigt',
    slug: 'e2e-seed-predigt',
    publishDate: '2026-01-15',
    episodeNumber: 7,
    duration: '0:01',
    speaker: 'Max Testsprecher',
    bodyText: 'Shownotes der Seed-Predigt.',
  },
} as const;

export async function seedContent(): Promise<void> {
  const token = await login();
  const { offer, episode } = SEED;
  await createOffer(token, {
    title: offer.title,
    category: offer.category,
    intro: offer.intro,
    schedule: offer.schedule,
    location: offer.location,
    targetAudience: offer.targetAudience,
    registration: offer.registration,
    organizers: [offer.organizer],
    body: `${offer.bodyText}\n\n- Erster Punkt\n- Zweiter Punkt`,
    withImage: true,
  });
  await createEpisode(token, {
    title: episode.title,
    publishDate: episode.publishDate,
    episodeNumber: episode.episodeNumber,
    duration: episode.duration,
    speakers: [{ name: episode.speaker, main: true }],
    body: episode.bodyText,
  });
}

export async function unseedContent(): Promise<void> {
  await deleteContent('offers', SEED.offer.slug);
  await deleteContent('podcast', SEED.episode.slug);
}
