import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { listOffers } from '../../lib/admin-content'

export const prerender = false

// Powers the header's "Angebote" dropdown/mobile panel, which must load client-side (see
// Header.astro) so it reflects R2 content immediately even on pages that are still statically
// prerendered. Grouping mirrors src/pages/angebote.astro exactly, including the static
// "Ich brauche Hilfe" entry hand-added to hilfe-service (that page is a standalone static page,
// not an R2-managed offer).
const categoryOrder = ['gottesdienst', 'kinder-jugend', 'gemeinschaft', 'senioren', 'hilfe-service'] as const
const categoryLabels: Record<(typeof categoryOrder)[number], string> = {
  gottesdienst: 'Gottesdienst',
  'kinder-jugend': 'Kinder & Jugend',
  gemeinschaft: 'Gemeinschaft',
  senioren: 'Senioren',
  'hilfe-service': 'Hilfe & Service',
}

export const GET: APIRoute = async () => {
  const offers = await listOffers(env.STORAGE)

  const groups = categoryOrder
    .map((category) => {
      const links = offers
        .filter((offer) => offer.data.category === category)
        .map((offer) => ({ label: offer.data.title, href: `/${offer.slug}` }))

      if (category === 'hilfe-service') {
        links.push({ label: 'Ich brauche Hilfe', href: '/ich-brauche-hilfe' })
      }

      return { label: categoryLabels[category], links }
    })
    .filter((group) => group.links.length > 0)

  return Response.json(groups)
}
