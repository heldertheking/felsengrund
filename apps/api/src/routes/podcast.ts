import { Hono } from 'hono'
import { getPodcastEpisode, listPodcastEpisodes, renderMarkdoc } from '@felsengrund/shared'
import type { Env } from '../types'
import { rewriteMediaUrls } from '../lib/media-url'

export const podcastRoute = new Hono<{ Bindings: Env }>()

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
