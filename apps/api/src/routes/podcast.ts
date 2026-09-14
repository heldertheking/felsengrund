import { Hono } from 'hono'
import { getPodcastEpisode, listPodcastEpisodes, renderMarkdoc } from '@felsengrund/api-core'
import type { Env } from '../types'
import { rewriteMediaUrls } from '../lib/media-url'
import { buildPodcastFeedXml, episodeToXmlItem } from '../lib/xml-feed'

export const podcastRoute = new Hono<{ Bindings: Env }>()

// Registered before `/podcast/:slug` so the static "feed.xml" segment can never be shadowed by
// the slug param route (Hono's router resolves static paths first regardless, but keeping the
// more specific route first here avoids relying on that).
podcastRoute.get('/podcast/feed.xml', async (c) => {
  const episodes = (await listPodcastEpisodes(c.env.STORAGE)).sort(
    (a, b) => new Date(b.data.publishDate).valueOf() - new Date(a.data.publishDate).valueOf(),
  )
  const items = await Promise.all(episodes.map((episode) => episodeToXmlItem(episode)))

  const xml = buildPodcastFeedXml({
    title: 'Kirche Felsengrund Podcast',
    link: `${c.env.PUBLIC_WEB_URL}/podcast`,
    atomLink: `${c.env.PUBLIC_WORKER_ORIGIN}/podcast/feed.xml`,
    description: 'Predigten von Kirche Felsengrund zum Nachhören.',
    language: 'de-ch',
    copyright: '&#169; 2026 Kirche Felsengrund',
    author: 'Kirche Felsengrund',
    ownerName: 'Oliver Lutz',
    ownerEmail: 'info@kirche-felsengrund.ch',
    imageUrl: `${c.env.PUBLIC_WEB_URL}/images/podcast-cover.png`,
    category: 'Religion & Spirituality',
    subcategory: 'Christianity',
    isExplicit: false,
    episodes: items,
  })

  return c.text(xml, 200, { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' })
})

podcastRoute.get('/podcast', async (c) => {
  const episodes = (await listPodcastEpisodes(c.env.STORAGE)).sort(
    (a, b) => new Date(b.data.publishDate).valueOf() - new Date(a.data.publishDate).valueOf(),
  )
  const rewritten = episodes.map((episode) => ({ ...episode, data: rewriteMediaUrls(c.env, episode.data) }))
  return c.json(rewritten)
})

podcastRoute.get('/podcast/:slug', async (c) => {
  const episode = await getPodcastEpisode(c.env.STORAGE, c.req.param('slug'))
  if (!episode) return c.json({ error: 'Episode nicht gefunden.' }, 404)

  return c.json({
    ...episode,
    data: rewriteMediaUrls(c.env, episode.data),
    bodyHtml: renderMarkdoc(episode.body),
  })
})
