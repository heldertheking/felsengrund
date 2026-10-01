import { Hono } from 'hono';
import { CATEGORY_DETAILS } from '@felsengrund/types';
import { createApiError, Env } from '../types';
import { MediaUtils, OffersRepository, StorageUtils } from '../lib';
import { createLogger } from '@felsengrund/logger';

// === Setup ===
const logger = createLogger('Offers Route');

// === Declarations ===

// Powers the header's "Angebote" dropdown. Mirrors the offers list grouping, plus a
// hand-added static "Ich brauche Hilfe" entry (not an R2-managed offer).
const categoryOrder = (Object.keys(CATEGORY_DETAILS) as (keyof typeof CATEGORY_DETAILS)[]).sort(
  (a, b) => CATEGORY_DETAILS[a].index - CATEGORY_DETAILS[b].index,
);

const categoryLabels: Record<(typeof categoryOrder)[number], string> = Object.fromEntries(
  categoryOrder.map((category) => [category, CATEGORY_DETAILS[category].label]),
) as Record<(typeof categoryOrder)[number], string>;

// === Routes ===

// Handlers are chained (not separate `offersRoute.get(...)` statements) so the route types
// accumulate on the instance - that is what `apps/web`'s Hono client is typed from.
export const offersRoute = new Hono<{ Bindings: Env }>()
  .get('/nav', async (c) => {
    const offers = await OffersRepository.list(c.env.STORAGE);
    if (offers.length == 0) {
      logger.warn('No offers found in Storage bucket.');
    }

    const groups = categoryOrder
      .map((category) => {
        const links = offers
          .filter((offer) => offer.data.category === category)
          .map((offer) => ({
            label: offer.data.title,
            href: `/angebote/${offer.slug}`,
          }));

        if (category === 'hilfe-service') {
          links.push({ label: 'Ich brauche Hilfe', href: '/ich-brauche-hilfe' });
        }

        return { label: categoryLabels[category], links };
      })
      .filter((group) => group.links.length > 0);

    return c.json(groups);
  })

  .get('/offers', async (c) => {
    const offers = await OffersRepository.list(c.env.STORAGE);
    if (offers.length == 0) {
      logger.warn('No offers found in Storage bucket.');
    }

    const rewritten = offers.map((offer) => ({
      ...offer,
      data: MediaUtils.rewriteMediaUrls(c.env, offer.data),
    }));
    return c.json(rewritten);
  })

  .get('/offers/:slug', async (c) => {
    const slug = c.req.param('slug');
    const offer = await OffersRepository.get(c.env.STORAGE, slug);
    if (!offer) {
      logger.warn('Offer not found in Storage bucket.', { slug });
      return c.json(createApiError('Offer not found', { slug }), 404);
    }

    return c.json({
      ...offer,
      data: MediaUtils.rewriteMediaUrls(c.env, offer.data),
      bodyHtml: StorageUtils.renderMarkdoc(offer.body),
    });
  });
