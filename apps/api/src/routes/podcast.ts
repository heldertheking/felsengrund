import { Hono } from 'hono';
import { createLogger } from '@felsengrund/logger';
import { createApiError, Env } from '../types';
import { FeedUtils, MediaUtils, PodcastRepository, StorageUtils } from '../lib';

// === Setup ===
export const podcastRoute = new Hono<{ Bindings: Env }>();
const logger = createLogger('podcast');

// === Routes ===

/** RSS 2.0 feed for podcast apps. Registered before /podcast/:slug so this static path isn't shadowed. */
podcastRoute.get('/podcast/feed.xml', async (c) => {
  const episodes = await PodcastRepository.list(c.env.STORAGE, true);

  // Isolate failures per episode so one malformed one doesn't take down the whole feed.
  const items = (
    await Promise.all(
      episodes.map(async (episode) => {
        try {
          return await FeedUtils.episodeToXmlItem(episode);
        } catch (error) {
          logger.error('failed to build feed item for episode - skipping it', {
            slug: episode.slug,
            error,
          });
          return null;
        }
      }),
    )
  ).filter((item) => item !== null);

  const xml = FeedUtils.buildPodcastFeedXml({
    title: 'Kirche Felsengrund Podcast',
    link: `${c.env.KFA_WEBPAGE_ORIGIN}/podcast`,
    atomLink: `${c.env.KFA_WORKER_ORIGIN}/podcast/feed.xml`,
    description: 'Predigten von Kirche Felsengrund zum Nachhören.',
    language: 'de-ch',
    copyright: '&#169; 2026 Kirche Felsengrund',
    author: 'Kirche Felsengrund',
    ownerName: 'Oliver Lutz',
    ownerEmail: 'info@kirche-felsengrund.ch',
    imageUrl: `${c.env.KFA_WEBPAGE_ORIGIN}/images/podcast-cover.png`,
    category: 'Religion & Spirituality',
    subcategory: 'Christianity',
    isExplicit: false,
    episodes: items,
  });

  const etag = await FeedUtils.generateETag(xml);
  // Episodes are sorted newest-first; the newest publish date is when the feed last meaningfully changed.
  const newest = episodes[0] ? new Date(episodes[0].data.publishDate) : undefined;
  const lastModified = newest && !Number.isNaN(newest.valueOf()) ? newest.toUTCString() : undefined;

  return c.text(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    ETag: etag,
    ...(lastModified && { 'Last-Modified': lastModified }),
  });
});

podcastRoute.get('/podcast', async (c) => {
  const sorted = await PodcastRepository.list(c.env.STORAGE, true);
  if (sorted.length == 0) {
    logger.warn('No episodes found in Storage bucket.');
  }

  const rewritten = sorted.map((episode) => ({
    ...episode,
    data: MediaUtils.rewriteMediaUrls(c.env, episode.data),
  }));
  return c.json(rewritten);
});

podcastRoute.get('/podcast/:slug', async (c) => {
  const episode = await PodcastRepository.get(c.env.STORAGE, c.req.param('slug'));
  if (!episode) {
    logger.warn('Episode not found in Storage bucket.', { slug: c.req.param('slug') });
    return c.json(createApiError('Episode not found', { slug: c.req.param('slug') }), 404);
  }

  return c.json({
    ...episode,
    data: MediaUtils.rewriteMediaUrls(c.env, episode.data),
    bodyHtml: StorageUtils.renderMarkdoc(episode.body),
  });
});
