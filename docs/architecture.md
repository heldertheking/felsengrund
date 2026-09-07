# Architecture: content & admin

This explains how content editing works after the Keystatic CMS was removed and replaced
with a custom admin panel backed directly by Cloudflare R2.

## Why Keystatic was removed

Keystatic's local-storage backend needs Node filesystem access to read/write content
files. That breaks under `@astrojs/cloudflare`'s workerd-based dev server and runtime,
which doesn't have a Node filesystem. Rather than work around that, content editing was
rebuilt as a small first-party admin panel that reads and writes R2 objects directly
through the Workers R2 API, which works the same in local dev and in production.

## Content model

Offers ("Angebote") and podcast episodes are stored as Markdoc documents: a YAML
frontmatter block followed by a Markdoc body, in the same format the original
Keystatic-managed `.mdoc` files used. There is no `src/content/` collection anymore —
these documents live as objects in the `STORAGE` R2 bucket, and are read at request time.

All of this logic lives in `src/lib/admin-content.ts`, which is the single module every
page and API route uses to read/write offers and podcast episodes. Key shapes:

```ts
interface OfferData {
  title: string
  intro?: string
  cardImage?: string
  category: 'gottesdienst' | 'kinder-jugend' | 'gemeinschaft' | 'senioren' | 'hilfe-service'
  targetAudience?: string
  schedule?: string
  location?: string
  mapsLink?: string
  organizers?: { name: string; role?: string; contact?: string }[]
  registration?: string
}

interface PodcastData {
  title: string
  episodeNumber?: number
  publishDate: string // ISO date (YYYY-MM-DD)
  audioUrl: string
  duration?: string
  coverImage?: string
}
```

Each entry also has a `slug` (derived from the title via `slugify()`, umlaut-aware) and a
`body` (the Markdoc source, rendered to HTML with `renderMarkdoc()` using `@markdoc/markdoc`).

R2 key layout (see [`docs/deployment.md`](./deployment.md) for the bucket-level view):

- `offers/<slug>.mdoc` — offer frontmatter + body
- `podcast/<slug>.mdoc` — podcast episode frontmatter + body
- `podcast/<slug>.<ext>` — that episode's audio file
- `images/offers/<slug>.<ext>` — an offer's card image
- `images/podcast/<slug>.<ext>` — an episode's cover image

`putOfferImage`/`putPodcastImage`/`putPodcastAudio` (also in `admin-content.ts`) write these
media objects and return the URL stored in `cardImage`/`coverImage`/`audioUrl`: a same-origin
`/media/<key>` path (e.g. `/media/podcast/<slug>.mp3`), not an absolute URL. That path is
served by `src/pages/media/[...key].ts`, a Worker route that streams the object straight off
the `STORAGE` binding — the same binding everything else here already uses, so it resolves
to local dev state or the real bucket automatically, with no separate public-access/CDN-domain
configuration needed in either environment. It supports `Range` requests (parses the
`Range` header, returns `206 Partial Content` with `Content-Range`), which the podcast
player (`src/components/podcast/PodcastPlayer.astro`) relies on for scrubbing through audio.

## Public pages read R2 at request time

Public pages are server-rendered (`export const prerender = false`) and call into
`admin-content.ts` on every request — there is no static build step for content, so an
edit made in `/admin` is visible on the public site immediately, with no redeploy:

- `src/pages/[slug].astro` — a single offer's detail page (`getOffer`)
- `src/pages/angebote.astro` — the full offers listing, grouped by category (`listOffers`)
- `src/components/home/AngeboteTeaser.astro` — the homepage's "Aktuelle Angebote" teaser,
  the first 4 offers ordered by category (`listOffers`); renders a friendly empty state if
  the bucket has no offers yet
- `src/pages/podcast/index.astro` — episode listing, sorted by `publishDate` descending
  (`listPodcastEpisodes`)
- `src/pages/podcast/[slug].astro` — a single episode's page, with an audio player
  (`getPodcastEpisode`)

## The `/admin` panel

### Reaching it

The site has no visible admin link. `src/components/Header.astro` renders an invisible,
`aria-hidden`, non-tabbable button (`[data-admin-trigger]`) absolutely positioned over the
top-right corner of the header. Clicking it **5 times within 2 seconds** reveals a small
panel with a link to `/admin` (the click counter resets after 2 seconds of inactivity, or
once it hits 5). This is a deliberately obscure entry point, not a security boundary — the
actual gate is the password login at `/admin` itself.

### Routes

Pages (`src/pages/admin/**`, all server-rendered, all require an authenticated session
except the login form itself):

| Route | Purpose |
|---|---|
| `GET /admin` | Password login form when unauthenticated; a dashboard with links to the two sections when authenticated |
| `GET /admin/offers` | List all offers, with links to edit each and a delete button |
| `GET /admin/offers/new` | Form to create a new offer |
| `GET /admin/offers/[slug]` | Form to edit an existing offer |
| `GET /admin/podcast` | List all podcast episodes, with links to edit each and a delete button |
| `GET /admin/podcast/new` | Form to create a new podcast episode |
| `GET /admin/podcast/[slug]` | Form to edit an existing episode |

The offer/podcast create and edit forms are shared components,
`src/components/admin/OfferForm.astro` and `src/components/admin/PodcastForm.astro`, used
by both the `new` and `[slug]` pages.

API routes (`src/pages/api/admin/**`), all requiring an authenticated session except login:

| Route | Method | Purpose |
|---|---|---|
| `/api/admin/login` | POST | Checks the submitted password against `ADMIN_UPLOAD_PASSWORD` and sets the session cookie |
| `/api/admin/logout` | POST | Clears the session cookie |
| `/api/admin/offers` | POST | Creates or updates an offer (multipart form; handles the optional `cardImage` upload) |
| `/api/admin/offers/[slug]` | DELETE | Deletes an offer |
| `/api/admin/podcast` | POST | Creates or updates a podcast episode (multipart form; handles the required `audio` upload and optional `coverImage`) |
| `/api/admin/podcast/[slug]` | DELETE | Deletes a podcast episode |

`AdminLayout.astro` (`src/layouts/AdminLayout.astro`) is the shared shell for every admin
page — it's deliberately minimal (no public header/nav/footer, `noindex, nofollow`) since
it's internal tooling, not a public page.

### Auth model

`src/lib/admin-auth.ts` implements a stateless, signed-cookie session — no KV, no database,
matching this project's general avoidance of Cloudflare KV (see the comment in
`astro.config.mjs` about `session: false`). The flow:

1. The admin submits the password to `POST /api/admin/login`.
2. The server compares it to the `ADMIN_UPLOAD_PASSWORD` secret. On success it issues a
   cookie whose value is `<expiry-timestamp>.<HMAC-SHA256 signature>`, where the signature
   is computed over the expiry timestamp using `ADMIN_UPLOAD_PASSWORD` itself as the HMAC
   key. The cookie is `HttpOnly; Secure; SameSite=Strict` with a 12-hour `Max-Age`.
3. Every subsequent admin page/API call re-verifies the cookie by recomputing the HMAC and
   comparing it (in constant time) against the signature in the cookie, and checking the
   expiry. Nothing is stored server-side — the cookie is self-contained proof that the
   holder once knew the password, within the last 12 hours.

Because the signing key is the password itself, rotating `ADMIN_UPLOAD_PASSWORD` (via
`wrangler secret put`, see [`docs/deployment.md`](./deployment.md)) immediately invalidates
all existing sessions, with no separate revocation step needed.

`ADMIN_UPLOAD_PASSWORD` is the single password for the entire admin panel — it is not
scoped separately per section, and (despite its name, a holdover from when it only gated
audio upload) it now gates offers, podcast episodes, and all admin uploads together.
