# Felsengrund

The public website for [Kirche Felsengrund](https://www.google.com/maps/search/Kirche+Felsengrund+Oetwil+am+See),
a church in Oetwil am See, Switzerland — plus a small self-service admin panel the church
team uses to manage its own content (offers/"Angebote" and podcast episodes) without
needing a developer for every update.

## Tech stack

- [Astro 7](https://astro.build/) running in SSR mode (no static content build — pages are
  rendered per-request)
- [`@astrojs/cloudflare`](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)
  adapter, deploying to Cloudflare Workers
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [React](https://react.dev/) via `@astrojs/react`, used for a handful of interactive
  islands rather than the whole UI: `src/components/home/HeroReveal.tsx` (a framer-motion
  fade/slide-in wrapper for the homepage hero), and the `FeedbackForm.tsx` /
  `PrayerWallForm.tsx` form components
- [Markdoc](https://markdoc.dev/) for rendering the rich-text body of offers and podcast
  episodes
- [Cloudflare R2](https://developers.cloudflare.com/r2/) for content and media storage
  (offers, podcast episodes, images, audio) — see [Content & Admin](#content--admin) below
- [Cloudflare Workers](https://workers.cloudflare.com/) for hosting

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars   # then fill in real values, see below
npm run dev
```

`.dev.vars` is gitignored and read automatically by the Astro/Wrangler dev server. It holds
two secrets (see `.dev.vars.example` for the authoritative list and inline notes):

- `ADMIN_UPLOAD_PASSWORD` — the password that gates the `/admin` content panel locally.
- `N8N_WEBHOOK_SECRET` — the HMAC signing secret used to authenticate the site's outgoing
  form-submission webhook calls to n8n (see `src/lib/notify.ts`).

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Starts the Astro dev server (`astro dev`) |
| `npm run build` | Type-checks and builds the site for production (`astro check && astro build`) |
| `npm run preview` | Serves the production build locally (`astro preview`) |
| `npm run lint` | Runs ESLint across the project (`eslint .`) |

## Content & Admin

Offers and podcast episodes are **not** stored as files in this repo. They live as Markdoc
documents in the `STORAGE` R2 bucket, and public pages read them straight from R2 on every
request — so an edit goes live immediately, with no redeploy.

Content is edited through a password-gated `/admin` panel. There's no visible link to it on
the site: click the top-right corner of the header 5 times within about 2 seconds to reveal
a discreet "Admin öffnen" link (see `src/components/Header.astro`).

For the full content model, the admin panel's routes, and how the auth session works, see
[`docs/architecture.md`](./docs/architecture.md).

## Deployment

For setting up the Cloudflare R2 bucket, secrets, and deploying to Cloudflare Workers, see
[`docs/deployment.md`](./docs/deployment.md).

## License

This repository is source-available for transparency, not open source in the permissive
sense. Viewing the code does not grant permission to reuse it: copying, redistributing,
modifying, or using this code or its content (including for AI/ML training, which is
prohibited outright) requires the copyright holder's explicit written permission. See
[`LICENSE`](./LICENSE) for the full terms.
