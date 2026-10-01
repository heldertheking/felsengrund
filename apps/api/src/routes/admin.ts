import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import {
  CATEGORY_DETAILS,
  type Category,
  type OfferFrontmatter,
  type OfferOrganizer,
  type EpisodeFrontmatter,
  type PodcastSpeaker,
} from '@felsengrund/types';
import { createLogger } from '@felsengrund/logger';
import { createApiError, type Env } from '../types';
import { AuthUtils, OffersRepository, PodcastRepository, StorageUtils } from '../lib';

const logger = createLogger('admin');

const requireAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const token = AuthUtils.parseBearerToken(c.req.header('authorization'));
  const authenticated = await AuthUtils.verifySessionToken(token, c.env.KFA_ADMIN_PASSWORD ?? '');
  if (!authenticated) return c.json(createApiError('Nicht angemeldet.'), 401);
  await next();
};

// === Input schemas ===
// The admin UI posts multipart forms. These schemas are what types the web client's `form` input
// (`apps/web` calls `api.admin.offers.$post({ form })`), and their messages are shown to the user.

const VALID_CATEGORIES = Object.keys(CATEGORY_DETAILS) as [Category, ...Category[]];

const requiredText = (message: string) => z.string({ error: message }).trim().min(1, message);
const optionalText = z.string().optional();
const optionalFile = z.instanceof(File).optional();

/** A JSON-encoded array sent as a form field. Missing or malformed values become an empty list. */
const jsonList = <T>() =>
  z
    .string()
    .optional()
    .transform((raw): T[] => {
      if (!raw?.trim()) return [];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as T[]) : [];
      } catch {
        return [];
      }
    });

const offerSchema = z.object({
  slug: optionalText, // present when editing
  title: requiredText('Titel fehlt.'),
  category: z.enum(VALID_CATEGORIES, { error: 'Ungültige Kategorie.' }),
  intro: optionalText,
  targetAudience: optionalText,
  schedule: optionalText,
  location: optionalText,
  mapsLink: optionalText,
  googleMapsIframeLink: optionalText,
  registration: optionalText,
  organizers: jsonList<OfferOrganizer>(),
  cardImage: optionalFile,
  body: optionalText,
});

const importSchema = z.object({
  file: z.instanceof(File, { error: 'Datei fehlt.' }),
});

const podcastSchema = z.object({
  slug: optionalText, // present when editing
  title: requiredText('Titel fehlt.'),
  publishDate: requiredText('Veröffentlichungsdatum fehlt.'),
  episodeNumber: optionalText,
  duration: optionalText,
  speakers: jsonList<PodcastSpeaker>(),
  audio: optionalFile, // required on create, optional when editing (checked in the handler)
  coverImage: optionalFile,
  body: optionalText,
});

const loginSchema = z.object({
  password: z.string(),
});

/** Multipart form validator that answers a bad request with the schema's own message. */
const formInput = <S extends z.ZodType>(schema: S) =>
  zValidator('form', schema, (result, c) => {
    if (!result.success) {
      return c.json(createApiError(result.error.issues[0]?.message ?? 'Ungültige Angaben.'), 400);
    }
  });

// === Routes ===

// Handlers are chained (not separate `adminRoute.post(...)` statements) so the route types
// accumulate on the instance - that is what `apps/web`'s Hono client is typed from.
export const adminRoute = new Hono<{ Bindings: Env }>()
  .post(
    '/admin/login',
    zValidator('form', loginSchema, (result, c) => {
      if (!result.success) return c.json(createApiError('Falsches Passwort.'), 401);
    }),
    async (c) => {
      const { password } = c.req.valid('form');

      if (!(await AuthUtils.verifyPassword(password, c.env.KFA_ADMIN_PASSWORD))) {
        return c.json(createApiError('Falsches Passwort.'), 401);
      }

      const token = await AuthUtils.createSessionToken(
        password,
        Number(c.env.KFA_SESSION_TTL_MS) || 12 * 60 * 60 * 1000,
      );
      return c.json({ token });
    },
  )

  // Bearer tokens can't be revoked server-side; kept as a real endpoint for symmetry / future revocation logic.
  .post('/admin/logout', async (c) => c.json({ ok: true }))

  // Everything below needs a valid session. Middleware must be registered before the handlers it guards.
  .use('/admin/offers', requireAuth)
  .use('/admin/offers/*', requireAuth)
  .use('/admin/podcast', requireAuth)
  .use('/admin/podcast/*', requireAuth)

  .post('/admin/offers', formInput(offerSchema), async (c) => {
    const input = c.req.valid('form');
    const { title, category } = input;

    const isEdit = Boolean(input.slug);
    const slug = input.slug ? input.slug : StorageUtils.slugify(title);
    if (!slug) return c.json(createApiError('Titel ergibt keinen gültigen Slug.'), 400);

    const existing = isEdit ? await OffersRepository.get(c.env.STORAGE, slug) : null;
    if (!isEdit) {
      const conflict = await OffersRepository.get(c.env.STORAGE, slug);
      if (conflict) {
        return c.json(createApiError('Ein Angebot mit diesem Titel existiert bereits.'), 409);
      }
    }

    const data: OfferFrontmatter = { title, category };
    if (input.intro) data.intro = input.intro;
    if (input.targetAudience) data.targetAudience = input.targetAudience;
    if (input.schedule) data.schedule = input.schedule;
    if (input.location) data.location = input.location;
    if (input.mapsLink) data.mapsLink = input.mapsLink;
    if (input.googleMapsIframeLink) data.googleMapsIframeLink = input.googleMapsIframeLink;
    if (input.registration) data.registration = input.registration;
    if (input.organizers.length > 0) data.organizers = input.organizers;

    const cardImageFile = input.cardImage;
    if (cardImageFile && cardImageFile.size > 0) {
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

    try {
      await OffersRepository.put(c.env.STORAGE, slug, data, input.body ?? '');
      logger.info('stored offer', { slug });
    } catch (error) {
      logger.error('failed to store offer', { slug, error });
      throw error;
    }

    return c.json({ slug });
  })

  .post('/admin/offers/import', formInput(importSchema), async (c) => {
    const { file } = c.req.valid('form');

    const raw = await file.text();
    const { data: rawData, body } = StorageUtils.formatMarkdocFile(raw);

    const title = typeof rawData.title === 'string' ? rawData.title.trim() : '';
    if (!title) return c.json(createApiError('Titel fehlt in der Datei.'), 400);

    if (!VALID_CATEGORIES.includes(rawData.category as Category)) {
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
  })

  .delete('/admin/offers/:slug', async (c) => {
    const slug = c.req.param('slug');
    if (!slug) return c.json(createApiError('Fehlender Slug.'), 400);

    await OffersRepository.delete(c.env.STORAGE, slug);

    return c.json({ ok: true });
  })

  .post('/admin/podcast', formInput(podcastSchema), async (c) => {
    const input = c.req.valid('form');
    const { title, publishDate } = input;

    const isEdit = Boolean(input.slug);
    const slug = input.slug ? input.slug : StorageUtils.slugify(title);
    if (!slug) return c.json(createApiError('Titel ergibt keinen gültigen Slug.'), 400);

    const existing = isEdit ? await PodcastRepository.get(c.env.STORAGE, slug) : null;
    if (!isEdit) {
      const conflict = await PodcastRepository.get(c.env.STORAGE, slug);
      if (conflict) {
        return c.json(createApiError('Eine Episode mit diesem Titel existiert bereits.'), 409);
      }
    }

    const audioFile = input.audio;
    let audioUrl = existing?.data.audioUrl;
    if (audioFile && audioFile.size > 0) {
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

    if (input.episodeNumber) {
      const episodeNumber = Number(input.episodeNumber);
      if (!Number.isNaN(episodeNumber)) data.episodeNumber = episodeNumber;
    }
    if (input.duration) data.duration = input.duration;
    if (input.speakers.length > 0) data.speakers = input.speakers;

    const coverImageFile = input.coverImage;
    if (coverImageFile && coverImageFile.size > 0) {
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

    try {
      await PodcastRepository.put(c.env.STORAGE, slug, data, input.body ?? '');
      logger.info('stored episode', { slug });
    } catch (error) {
      logger.error('failed to store episode', { slug, error });
      throw error;
    }

    return c.json({ slug });
  })

  .delete('/admin/podcast/:slug', async (c) => {
    const slug = c.req.param('slug');
    if (!slug) return c.json(createApiError('Fehlender Slug.'), 400);

    await PodcastRepository.delete(c.env.STORAGE, slug);

    return c.json({ ok: true });
  });
