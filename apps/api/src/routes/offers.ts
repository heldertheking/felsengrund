import { Hono } from 'hono'
import { getOffer, listOffers, renderMarkdoc } from '@felsengrund/shared'
import type { Env } from '../types'
import { rewriteMediaUrls } from '../lib/media-url'

export const offersRoute = new Hono<{ Bindings: Env }>()

// Powers the frontend header's "Angebote" dropdown/mobile panel. Grouping mirrors the offers
// list page exactly, including the static "Ich brauche Hilfe" entry hand-added to
// hilfe-service (that page is a standalone static page, not an R2-managed offer).
const categoryOrder = ['gottesdienst', 'kinder-jugend', 'gemeinschaft', 'senioren', 'hilfe-service'] as const
const categoryLabels: Record<(typeof categoryOrder)[number], string> = {
  gottesdienst: 'Gottesdienst',
  'kinder-jugend': 'Kinder & Jugend',
  gemeinschaft: 'Gemeinschaft',
  senioren: 'Senioren',
  'hilfe-service': 'Hilfe & Service',
}

offersRoute.get('/nav', async (c) => {
  const offers = await listOffers(c.env.STORAGE)

  const groups = categoryOrder
    .map((category) => {
      const links = offers
        .filter((offer) => offer.data.category === category)
        .map((offer) => ({ label: offer.data.title, href: `/angebote/${offer.slug}` }))

      if (category === 'hilfe-service') {
        links.push({ label: 'Ich brauche Hilfe', href: '/ich-brauche-hilfe' })
      }

      return { label: categoryLabels[category], links }
    })
    .filter((group) => group.links.length > 0)

  return c.json(groups)
})

offersRoute.get('/offers', async (c) => {
  const offers = await listOffers(c.env.STORAGE)
  const rewritten = offers.map((offer) => ({ ...offer, data: rewriteMediaUrls(c.env, offer.data) }))
  return c.json(rewritten)
})

offersRoute.get('/offers/:slug', async (c) => {
  const offer = await getOffer(c.env.STORAGE, c.req.param('slug'))
  if (!offer) return c.json({ error: 'Angebot nicht gefunden.' }, 404)

  return c.json({
    ...offer,
    data: rewriteMediaUrls(c.env, offer.data),
    bodyHtml: renderMarkdoc(offer.body),
  })
})
