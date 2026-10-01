import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  CATEGORY_DETAILS,
  type OfferFrontmatter,
  type OfferOrganizer,
  type EpisodeFrontmatter,
} from '@felsengrund/types';
import { createLogger } from '@felsengrund/logger';
import { createApiError, type Env } from '../types';
import { AuthUtils, OffersRepository, PodcastRepository, StorageUtils } from '../lib';

export const adminRoute = new Hono<{ Bindings: Env }>();

const logger = createLogger('admin');

const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = AuthUtils.parseBearerToken(c.req.header('authorization'));
  const authenticated = await AuthUtils.verifySessionToken(token, c.env.KFA_ADMIN_PASSWORD ?? '');
  if (!authenticated) return c.json(createApiError('Nicht angemeldet.'), 401);
  await next();
};

adminRoute.post('/admin/login', async (c) => {
  const formData = await c.req.formData();
  const password = formData.get('password');

  if (typeof password !== 'string' || !(await AuthUtils.verifyPassword(password, c.env.KFA_ADMIN_PASSWORD))) {
    return c.json(createApiError('Falsches Passwort.'), 401);
  }

  const token = await AuthUtils.createSessionToken(password, Number(c.env.KFA_SESSION_TTL_MS) || 12 * 60 * 60 * 1000);
  return c.json({ token });
});

// Bearer tokens can't be revoked server-side; kept as a real endpoint for symmetry / future revocation logic.
adminRoute.post('/admin/logout', async (c) => c.json({ ok: true }));

adminRoute.use('/admin/offers', requireAuth);
adminRoute.use('/admin/offers/*', requireAuth);
adminRoute.use('/admin/podcast', requireAuth);
adminRoute.use('/admin/podcast/*', requireAuth);

const VALID_CATEGORIES = Object.keys(CATEGORY_DETAILS) as OfferFrontmatter['category'][];

adminRoute.post('/admin/offers', async (c) => {
  const formData = await c.req.formData();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return c.json(createApiError('Titel fehlt.'), 400);

  const category = String(formData.get('category') ?? '');
  if (!VALID_CATEGORIES.includes(category as OfferFrontmatter['category'])) {
    return c.json(createApiError('Ungültige Kategorie.'), 400);
  }

  const slugField = formData.get('slug');
  const isEdit = typeof slugField === 'string' && slugField.length > 0;
  const slug = isEdit ? (slugField as string) : StorageUtils.slugify(title);
  if (!slug) return c.json(createApiError('Titel ergibt keinen gültigen Slug.'), 400);

  const existing = isEdit ? await OffersRepository.get(c.env.STORAGE, slug) : null;
  if (!isEdit) {
    const conflict = await OffersRepository.get(c.env.STORAGE, slug);
    if (conflict) {
      return c.json(createApiError('Ein Angebot mit diesem Titel existiert bereits.'), 409);
    }
  }

  const organizersRaw = formData.get('organizers');
  let organizers: OfferOrganizer[] = [];
  if (typeof organizersRaw === 'string' && organizersRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(organizersRaw);
      if (Array.isArray(parsed)) organizers = parsed;
    } catch {
      organizers = [];
    }
  }

  const data: OfferFrontmatter = {
    title,
    category: category as OfferFrontmatter['category'],
  };

  const intro = formData.get('intro');
  if (intro) data.intro = String(intro);
  const targetAudience = formData.get('targetAudience');
  if (targetAudience) data.targetAudience = String(targetAudience);
  const schedule = formData.get('schedule');
  if (schedule) data.schedule = String(schedule);
  const location = formData.get('location');
  if (location) data.location = String(location);
  const mapsLink = formData.get('mapsLink');
  if (mapsLink) data.mapsLink = String(mapsLink);
  const googleMapsIframeLink = formData.get('googleMapsIframeLink');
  if (googleMapsIframeLink) data.googleMapsIframeLink = String(googleMapsIframeLink);
  const registration = formData.get('registration');
  if (registration) data.registration = String(registration);
  if (organizers.length > 0) data.organizers = organizers;

  const cardImageFile = formData.get('cardImage');
  if (cardImageFile && typeof cardImageFile !== 'string' && cardImageFile.size > 0) {
    try {
      data.cardImage = await OffersRepository.putImage(c.env.STORAGE, slug, cardImageFile);
      if (existing?.data.cardImage && existing.data.cardImage !== data.cardImage) {
        await StorageUtils.deleteMedia(c.env.STORAGE, [existing.data.cardImage]);
      }
      logger.info('stored cardImage', { slug, cardImage: data.cardImage });
    } catch (error) {
      logger.error('failed to store cardImage', { slug, error });
      throw error;
    }
  } else if (existing?.data.cardImage) {
    data.cardImage = existing.data.cardImage;
  }

  const body = String(formData.get('body') ?? '');

  try {
    await OffersRepository.put(c.env.STORAGE, slug, data, body);
    logger.info('stored offer', { slug });
  } catch (error) {
    logger.error('failed to store offer', { slug, error });
    throw error;
  }

  return c.json({ slug });
});

adminRoute.post('/admin/offers/import', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') return c.json(createApiError('Datei fehlt.'), 400);

  const raw = await file.text();
  const { data: rawData, body } = StorageUtils.formatMarkdocFile(raw);

  const title = typeof rawData.title === 'string' ? rawData.title.trim() : '';
  if (!title) return c.json(createApiError('Titel fehlt in der Datei.'), 400);

  if (!VALID_CATEGORIES.includes(rawData.category as OfferFrontmatter['category'])) {
    return c.json(createApiError('Ungültige oder fehlende Kategorie in der Datei.'), 400);
  }

  const slug = StorageUtils.slugify(title);
  if (!slug) return c.json(createApiError('Titel ergibt keinen gültigen Slug.'), 400);

  const conflict = await OffersRepository.get(c.env.STORAGE, slug);
  if (conflict) return c.json(createApiError('Ein Angebot mit diesem Titel existiert bereits.'), 409);

  const data = { ...rawData, title } as OfferFrontmatter;

  try {
    await OffersRepository.put(c.env.STORAGE, slug, data, body);
    logger.info('imported offer', { slug });
  } catch (error) {
    logger.error('failed to import offer', { slug, error });
    throw error;
  }

  return c.json({ slug });
});

adminRoute.delete('/admin/offers/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json(createApiError('Fehlender Slug.'), 400);

  await OffersRepository.delete(c.env.STORAGE, slug);

  return c.json({ ok: true });
});

adminRoute.post('/admin/podcast', async (c) => {
  const formData = await c.req.formData();
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return c.json(createApiError('Titel fehlt.'), 400);

  const publishDate = String(formData.get('publishDate') ?? '').trim();
  if (!publishDate) return c.json(createApiError('Veröffentlichungsdatum fehlt.'), 400);

  const slugField = formData.get('slug');
  const isEdit = typeof slugField === 'string' && slugField.length > 0;
  const slug = isEdit ? (slugField as string) : StorageUtils.slugify(title);
  if (!slug) return c.json(createApiError('Titel ergibt keinen gültigen Slug.'), 400);

  const existing = isEdit ? await PodcastRepository.get(c.env.STORAGE, slug) : null;
  if (!isEdit) {
    const conflict = await PodcastRepository.get(c.env.STORAGE, slug);
    if (conflict) {
      return c.json(createApiError('Eine Episode mit diesem Titel existiert bereits.'), 409);
    }
  }

  const audioFile = formData.get('audio');
  let audioUrl = existing?.data.audioUrl;
  if (audioFile && typeof audioFile !== 'string' && audioFile.size > 0) {
    try {
      audioUrl = await PodcastRepository.putAudio(c.env.STORAGE, slug, audioFile);
      if (existing?.data.audioUrl && existing.data.audioUrl !== audioUrl) {
        await StorageUtils.deleteMedia(c.env.STORAGE, [existing.data.audioUrl]);
      }
      logger.info('stored audio', { slug, audioUrl });
    } catch (error) {
      logger.error('failed to store audio', { slug, error });
      throw error;
    }
  }
  if (!audioUrl) return c.json(createApiError('Audiodatei fehlt.'), 400);

  const data: EpisodeFrontmatter = { title, publishDate, audioUrl };

  const episodeNumberRaw = formData.get('episodeNumber');
  if (episodeNumberRaw) {
    const episodeNumber = Number(episodeNumberRaw);
    if (!Number.isNaN(episodeNumber)) data.episodeNumber = episodeNumber;
  }

  const duration = formData.get('duration');
  if (duration) data.duration = String(duration);

  const speakersRaw = formData.get('speakers');
  if (typeof speakersRaw === 'string' && speakersRaw.trim().length > 0) {
    try {
      const parsed = JSON.parse(speakersRaw);
      if (Array.isArray(parsed) && parsed.length > 0) data.speakers = parsed;
    } catch {
      // ignore malformed speakers payload
    }
  }

  const coverImageFile = formData.get('coverImage');
  if (coverImageFile && typeof coverImageFile !== 'string' && coverImageFile.size > 0) {
    try {
      data.coverImage = await PodcastRepository.putImage(c.env.STORAGE, slug, coverImageFile);
      if (existing?.data.coverImage && existing.data.coverImage !== data.coverImage) {
        await StorageUtils.deleteMedia(c.env.STORAGE, [existing.data.coverImage]);
      }
      logger.info('stored coverImage', { slug, coverImage: data.coverImage });
    } catch (error) {
      logger.error('failed to store coverImage', { slug, error });
      throw error;
    }
  } else if (existing?.data.coverImage) {
    data.coverImage = existing.data.coverImage;
  }

  const body = String(formData.get('body') ?? '');

  try {
    await PodcastRepository.put(c.env.STORAGE, slug, data, body);
    logger.info('stored episode', { slug });
  } catch (error) {
    logger.error('failed to store episode', { slug, error });
    throw error;
  }

  return c.json({ slug });
});

adminRoute.delete('/admin/podcast/:slug', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json(createApiError('Fehlender Slug.'), 400);

  await PodcastRepository.delete(c.env.STORAGE, slug);

  return c.json({ ok: true });
});
