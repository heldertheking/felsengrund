import { Hono } from 'hono';
import {
  getPodcastEpisode,
  listPodcastEpisodes,
  listSortedPodcastEpisodes,
  renderMarkdoc,
} from '@felsengrund/api-core';
import type { Env } from '../types';
import { rewriteMediaUrls } from '../lib/media-url';
import { buildPodcastFeedXml, episodeToXmlItem, generateETag } from '../lib/xml-feed';

export const podcastRoute = new Hono<{ Bindings: Env }>();

/**
 * Returns an RSS 2.0 Feed ready to be used on YouTube music, Spotify, etc. for podcast.
 * <p>Registered before /podcast/:slug to ensure static path is not shadowd.</p>
 */
podcastRoute.get('/podcast/feed.xml', async (c) => {
  const episodes = (await listPodcastEpisodes(c.env.STORAGE)).sort(
    (a, b) => new Date(b.data.publishDate).valueOf() - new Date(a.data.publishDate).valueOf(),
  );
  const items = await Promise.all(episodes.map((episode) => episodeToXmlItem(episode)));

  const xml = buildPodcastFeedXml({
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

  const etag = await generateETag(xml);

  return c.text(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    ETag: etag,
    'Last-Modified': new Date().toUTCString(),
  });
});

podcastRoute.get('/podcast', async (c) => {
  const sorted = await listSortedPodcastEpisodes(c.env.STORAGE);
  const rewritten = sorted.map((episode) => ({
    ...episode,
    data: rewriteMediaUrls(c.env, episode.data),
  }));
  return c.json(rewritten);
});

podcastRoute.get('/podcast/:slug', async (c) => {
  const episode = await getPodcastEpisode(c.env.STORAGE, c.req.param('slug'));
  if (!episode) return c.json({ error: 'Episode nicht gefunden.' }, 404);

  return c.json({
    ...episode,
    data: rewriteMediaUrls(c.env, episode.data),
    bodyHtml: renderMarkdoc(episode.body),
  });
});
