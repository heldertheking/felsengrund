# Architecture: content & admin

This explains how content editing works after the Keystatic CMS was removed and replaced
with a custom admin panel backed directly by Cloudflare R2, and how that panel now works
now that the site is split into a static frontend (`apps/web`, deployed to webkeeper.ch) and
a pure JSON API (`apps/api`, a Cloudflare Worker) — see [`docs/deployment.md`](./deployment.md)
for the deploy-level view of that split.

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

All of this logic lives in `packages/api-core/src/admin-content.ts`, which every route in
`apps/api` uses to read/write offers and podcast episodes — `apps/web` never touches R2
directly, it only ever sees the JSON `apps/api` returns. Key shapes:

```ts
interface OfferData {
  title: string;
  intro?: string;
  cardImage?: string;
  category: 'gottesdienst' | 'kinder-jugend' | 'gemeinschaft' | 'senioren' | 'hilfe-service';
  targetAudience?: string;
  schedule?: string;
  location?: string;
  mapsLink?: string;
  organizers?: { name: string; role?: string; contact?: string }[];
  registration?: string;
}

interface PodcastData {
  title: string;
  episodeNumber?: number;
  publishDate: string; // ISO date (YYYY-MM-DD)
  audioUrl: string;
  duration?: string;
  coverImage?: string;
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
media objects and return the URL stored in `cardImage`/`coverImage`/`audioUrl`: a relative
`/media/<key>` path (e.g. `/media/podcast/<slug>.mp3`), not an absolute URL. Since `apps/web`
and `apps/api` are different origins, `apps/api`'s offers/podcast/nav routes rewrite these to
absolute URLs (`${PUBLIC_WORKER_ORIGIN}/media/<key>`, see `apps/api/src/lib/media-url.ts`)
before returning JSON, so the frontend never needs its own origin-joining logic — it just
renders whatever URL it's given. The actual bytes are served by `apps/api/src/routes/media.ts`
(`GET /media/*`), which streams the object straight off the `STORAGE` binding, with `Range`
request support (parses the `Range` header, returns `206 Partial Content` with
`Content-Range`) for podcast audio scrubbing.

## Public pages fetch from the API client-side

`apps/web` is a fully static build — there is no per-request server rendering anymore.
Offers and podcast content are fetched client-side from `apps/api` (SPA-style, an explicit
trade-off against SEO/prerendering the team accepted for now):

- `apps/web/src/components/OfferDetail.tsx` — a single offer's detail page, fetching
  `GET /offers/:slug` from the API, mounted from the static shell at
  `apps/web/src/pages/angebote/detail.astro` (any `/angebote/<slug>` request is rewritten to
  this shell by `apps/web/public/.htaccess`, since the slug isn't known at build time — note
  the shell file is _not_ named with a leading underscore: Astro silently excludes
  `_`-prefixed files from routing, which would make this page never build at all)
- `apps/web/src/components/OffersGrid.tsx` — the full offers listing, grouped by category,
  fetching `GET /offers`, mounted at `apps/web/src/pages/angebote/index.astro`
- `apps/web/src/components/home/AngeboteTeaser.tsx` — the homepage's "Aktuelle Angebote"
  teaser (also fetches `GET /offers` — it used to read R2 directly)
- `apps/web/src/components/PodcastList.tsx` — episode listing, fetching `GET /podcast`,
  mounted at `apps/web/src/pages/podcast/index.astro`
- `apps/web/src/components/PodcastDetail.tsx` — a single episode's page with an audio
  player, fetching `GET /podcast/:slug`, mounted at `apps/web/src/pages/podcast/detail.astro`
  (same `.htaccess` rewrite pattern as offers)

Because content is fetched at request time from the API (not baked into the static build),
an edit made in `/admin` is still visible on the public site immediately with no frontend
redeploy — the client refetches on every page load.

## The `/admin` panel

The admin CMS is no longer server-rendered — `apps/api` serves no HTML at all. It's a
client-rendered React app (`apps/web/src/components/admin/AdminApp.tsx`), mounted from one
static shell page (`apps/web/src/pages/admin/index.astro`), that calls `apps/api`'s
`/admin/*` routes over `fetch()` with a bearer token. `apps/web/public/.htaccess` rewrites
every `/admin/*` path to that same shell, since `AdminApp` handles its own internal
view-switching (login → offers list → offer edit form → podcast list → podcast edit form)
in React state rather than distinct statically-enumerable Astro pages.

### Reaching it

`apps/web/src/components/Header.astro` still renders the invisible, `aria-hidden`,
non-tabbable button (`[data-admin-trigger]`) over the header's top-right corner. Clicking it
**5 times within 2 seconds** reveals a small panel with a link to `/admin` (same-origin,
since `/admin` now lives in `apps/web` itself). Deliberately obscure, not a security
boundary — the actual gate is the password login inside `AdminApp`.

### API routes (`apps/api/src/routes/admin.ts`)

All requiring a valid bearer token except login:

| Route                  | Method | Purpose                                                                                                              |
| ---------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- |
| `/admin/login`         | POST   | Checks the submitted password against `KFA_ADMIN_PASSWORD`; on success returns `{ token }`                        |
| `/admin/logout`        | POST   | Stateless no-op (kept for symmetry/future revocation) — the frontend just discards its stored token                  |
| `/admin/offers`        | POST   | Creates or updates an offer (multipart form; handles the optional `cardImage` upload)                                |
| `/admin/offers/:slug`  | DELETE | Deletes an offer                                                                                                     |
| `/admin/podcast`       | POST   | Creates or updates a podcast episode (multipart form; handles the required `audio` upload and optional `coverImage`) |
| `/admin/podcast/:slug` | DELETE | Deletes a podcast episode                                                                                            |

`AdminApp.tsx`'s `OffersManager`/`PodcastManager` sub-components (in
`apps/web/src/components/admin/`) are the React equivalents of the old
`OfferForm.astro`/`PodcastForm.astro` — same fields and multipart upload behavior, just
calling these absolute cross-origin URLs with `Authorization: Bearer <token>` instead of a
relative same-origin `fetch` with `credentials: 'same-origin'`.

### Auth model

`packages/api-core/src/admin-auth.ts` implements a stateless, signed **bearer token** — no KV,
no database. This replaced the original signed-cookie session once the admin UI and the API
became different origins: cookies scoped `SameSite=Strict`/`Lax` are never sent cross-site at
all, and relaxing to `SameSite=None` would trade that for third-party-cookie fragility with
no real benefit, so a token the frontend attaches explicitly is the simpler fit for a
cross-origin client/API split. The flow:

1. The admin submits the password to `POST /admin/login` on `apps/api`.
2. The server compares it to the `KFA_ADMIN_PASSWORD` secret. On success it returns a
   JSON body `{ token }`, where the token string is `<expiry-timestamp>.<HMAC-SHA256
signature>`, the signature computed over the expiry timestamp using
   `KFA_ADMIN_PASSWORD` itself as the HMAC key (12-hour expiry).
3. `AdminApp.tsx` stores that token in `localStorage` and sends it as
   `Authorization: Bearer <token>` on every subsequent `/admin/*` call. `apps/api`'s
   `requireAuth` middleware re-verifies it by recomputing the HMAC and comparing it (in
   constant time) against the signature, and checking the expiry. Nothing is stored
   server-side — the token is self-contained proof that the holder once knew the password,
   within the last 12 hours.

Because the signing key is the password itself, rotating `KFA_ADMIN_PASSWORD` (via
`wrangler secret put`, see [`docs/deployment.md`](./deployment.md)) immediately invalidates
all existing sessions, with no separate revocation step needed.

`KFA_ADMIN_PASSWORD` is the single password for the entire admin panel — it is not
scoped separately per section, and (despite its name, a holdover from when it only gated
audio upload) it now gates offers, podcast episodes, and all admin uploads together.
