# Architecture: content & admin

This explains how content editing works: a custom admin panel backed directly by Cloudflare
R2, and how that panel works now that the site is split into a static frontend (`apps/web`,
deployed to webkeeper.ch) and a pure JSON API (`apps/api`, a Cloudflare Worker) — see
[`docs/deployment.md`](./deployment.md) for the deploy-level view of that split.

## Why content lives in R2, not the filesystem

A filesystem-backed CMS needs Node filesystem access to read/write content files, which
breaks under `@astrojs/cloudflare`'s workerd-based dev server and runtime — it doesn't have
a Node filesystem. Content editing is instead a small first-party admin panel that reads and
writes R2 objects directly through the Workers R2 API, which works the same in local dev and
in production.

## Content model

Offers ("Angebote") and podcast episodes are stored as Markdoc documents: a YAML
frontmatter block followed by a Markdoc body. There is no `src/content/` collection —
these documents live as objects in the `STORAGE` R2 bucket, and are read at request time.

All of this logic lives in `apps/api/src/lib/storage/` (the former `packages/api-core` package
was folded into `apps/api`): `OffersRepository` (`offers.ts`) and `PodcastRepository`
(`podcast.ts`) expose `list`/`get`/`put`/`delete` (plus `putImage`, and `putAudio` for podcast)
and are what every route in `apps/api` uses to read/write offers and podcast episodes — `apps/web`
never touches R2 directly, it only ever sees the JSON `apps/api` returns. The shared helpers
(`formatMarkdocFile`, `serializeMdocFile`, `listSlugs`, key prefixes) live in `storage/shared.ts`
(so the repositories don't import each other's parent module); `storage/index.ts` assembles
`StorageUtils` (`renderMarkdoc`, `slugify`, `formatMarkdocFile`, `deleteMedia`). Deleting an offer or
episode also deletes its image/audio objects, and replacing a media file with a different extension
removes the old object. Routes
import all of this through the `apps/api/src/lib/index.ts` barrel (`AuthUtils`, `FeedUtils`,
`MediaUtils`, `StorageUtils`, `OffersRepository`, `PodcastRepository`, `NotificationService`, `FORMS`). The offer/episode types
(`Offer`, `Episode`, `OfferFrontmatter`, `EpisodeFrontmatter`) come from `packages/types`. Key shapes:

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
`body` (the Markdoc source, rendered to HTML with `StorageUtils.renderMarkdoc()` using `@markdoc/markdoc`).

R2 key layout (see [`docs/deployment.md`](./deployment.md) for the bucket-level view):

- `offers/<slug>.mdoc` — offer frontmatter + body
- `podcast/<slug>.mdoc` — podcast episode frontmatter + body
- `podcast/<slug>.<ext>` — that episode's audio file
- `images/offers/<slug>.<ext>` — an offer's card image
- `images/podcast/<slug>.<ext>` — an episode's cover image

`OffersRepository.putImage`/`PodcastRepository.putImage`/`PodcastRepository.putAudio` write these
media objects and return the URL stored in `cardImage`/`coverImage`/`audioUrl`: a relative
`/media/<key>` path (e.g. `/media/podcast/<slug>.mp3`), not an absolute URL. Since `apps/web`
and `apps/api` are different origins, `apps/api`'s offers/podcast/nav routes rewrite these to
absolute URLs (`${KFA_WORKER_ORIGIN}/media/<key>`, via `MediaUtils.rewriteMediaUrls()` in
`apps/api/src/lib/media/index.ts`)
before returning JSON, so the frontend never needs its own origin-joining logic — it just
renders whatever URL it's given. The actual bytes are served by `apps/api/src/routes/media.ts`
(`GET /media/*`), which streams the object straight off the `STORAGE` binding, with `Range`
request support for podcast audio scrubbing: `parseRangeHeader()`/`toR2Range()` (in
`lib/media/index.ts`) parse the header, and the route returns `206 Partial Content` with
`Content-Range`, falling back to the full object if R2 rejects the range.

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
| `/admin/login`         | POST   | Checks the submitted password against `KFA_ADMIN_PASSWORD` (constant-time); on success returns `{ token }`                           |
| `/admin/logout`        | POST   | Stateless no-op (kept for symmetry/future revocation) — the frontend just discards its stored token                  |
| `/admin/offers`        | POST   | Creates or updates an offer (multipart form; handles the optional `cardImage` upload)                                |
| `/admin/offers/import` | POST   | Imports an offer from an uploaded `.mdoc` file (frontmatter + body); 409 if the slug already exists                  |
| `/admin/offers/:slug`  | DELETE | Deletes an offer                                                                                                     |
| `/admin/podcast`       | POST   | Creates or updates a podcast episode (multipart form; handles the required `audio` upload and optional `coverImage`) |
| `/admin/podcast/:slug` | DELETE | Deletes a podcast episode                                                                                            |

`AdminApp.tsx`'s `OffersManager`/`PodcastManager` subcomponents (in
`apps/web/src/components/admin/`) are the React equivalents of the old
`OfferForm.astro`/`PodcastForm.astro` — same fields and multipart upload behavior, just
calling these absolute cross-origin URLs with `Authorization: Bearer <token>` instead of a
relative same-origin `fetch` with `credentials: 'same-origin'`.

### Auth model

`apps/api/src/lib/authentication/index.ts` (`AuthUtils`) implements a stateless, signed **bearer token** — no KV,
no database. This replaced the original signed-cookie session once the admin UI and the API
became different origins: cookies scoped `SameSite=Strict`/`Lax` are never sent cross-site at
all, and relaxing to `SameSite=None` would trade that for third-party-cookie fragility with
no real benefit, so a token the frontend attaches explicitly is the simpler fit for a
cross-origin client/API split. The flow:

1. The admin submits the password to `POST /admin/login` on `apps/api`.
2. The server compares it to the `KFA_ADMIN_PASSWORD` secret. On success, it returns a
   JSON body `{ token }`, where the token string is `<expiry-timestamp>.<HMAC-SHA256
signature>`, the signature computed over the expiry timestamp using
   `KFA_ADMIN_PASSWORD` itself as the HMAC key. Expiry comes from the `KFA_SESSION_TTL_MS` var
   (`43200000` ms = 12 hours in `wrangler.jsonc`; login falls back to 12 hours if it's unset).
3. `AdminApp.tsx` stores that token in `localStorage` and sends it as
   `Authorization: Bearer <token>` on every subsequent `/admin/*` call. `apps/api`'s
   `requireAuth` middleware re-verifies it by recomputing the HMAC and comparing it (in
   constant time) against the signature, and checking the expiry. Nothing is stored
   server-side — the token is self-contained proof that the holder once knew the password,
   within the TTL window.

Because the signing key is the password itself, rotating `KFA_ADMIN_PASSWORD` (via
`wrangler secret put`, see [`docs/deployment.md`](./deployment.md)) immediately invalidates
all existing sessions, with no separate revocation step needed.

`KFA_ADMIN_PASSWORD` is the single password for the entire admin panel — it is not
scoped separately per section, and (despite its name, a holdover from when it only gated
audio upload) it now gates offers, podcast episodes, and all admin uploads together.

## Podcast RSS feed

`GET /podcast/feed.xml` (`apps/api/src/routes/podcast.ts`) serves an RSS 2.0 feed with iTunes
and `content:encoded` extensions for podcast apps. It is registered before `/podcast/:slug` so the
static path isn't shadowed. The XML is built by `FeedUtils` (`apps/api/src/lib/feed/index.ts`):
`episodeToXmlItem()` maps an episode to a feed item — looking up the audio's size and content type
with `STORAGE.head()`, building absolute audio/cover URLs from `KFA_WORKER_ORIGIN` and episode links
from `KFA_WEBPAGE_ORIGIN` — and `buildPodcastFeedXml()` renders the channel. A malformed episode
(e.g. an invalid `publishDate`) is logged and skipped instead of failing the whole feed. The
response carries a SHA-256-derived `ETag` and `Cache-Control: public, max-age=3600, s-maxage=86400`.
`Last-Modified` is the newest episode's publish date. Channel metadata (title, owner, category, cover image at `${KFA_WEBPAGE_ORIGIN}/images/podcast-cover.png`)
is hardcoded in the route.

## Error responses

Every route returns errors as `createApiError(message, meta?)` (`apps/api/src/types.ts`):
`{ status: 'error' | 'fail', message, meta? }`. `packages/types`' `ErrorResponse` and the shared
API client (`BaseClient`/`AdminClient`) read `message` and surface it in the UI. Form routes use
`createFormError`, which adds `type` and `validationErrors`:

- Validation failure: `400` with `{ status: 'error', type: 'validation', message: 'Missing fields',
  validationErrors: { missing: [...] }, meta: { submittedAt } }`.
- Email delivery failure: `502` with `{ status: 'fail', type: 'sending', message }` (logged server-side).
- Unhandled errors: `500` via `onError`, with `meta.requestId` matching the log line.
- Admin messages are German, since they're shown to the editor.

## Forms & notification emails

Every public form (contact, counseling, feedback, prayer request) posts to a single
endpoint, `POST /forms` in `apps/api/src/routes/forms.ts`, with the body
`{ id, payload }`. `payload` is the raw field values collected by `BaseForm.astro`
(`FormPayload`, keyed by each field's `name`). The route:

1. rejects unknown form ids (`400`),
2. runs the form's validator, if it has one (`400` with `{ error }` on failure),
3. translates the payload into a notification (`lib/form-notifications.ts`) and sends it,
4. returns `{ ok: true }`.

### Adding a form

1. **`packages/types/src/Forms.ts`** — add the form id and its input shape to `FormInputs`
   (field names = the `name` attributes in the Astro form), and add an entry to
   `formValidators`: a validator returning an error message or `null`, or `null` instead of a
   validator if the frontend's validation is enough. Both are exhaustive over `FormId`, so a
   missing entry is a compile error.
2. **`apps/api/src/lib/form-notifications.ts`** — add the matching entry that turns the typed
   input into `{ subject, content, mailbox, options }`. This is the translation layer between
   the general form model and the mail system; it's the only place that needs to change when
   the mails are reworked.
3. **`apps/web`** — use `<BaseForm formId="...">`. `formId` is typed as `FormId`, so only
   registered ids compile. `src/lib/forms.ts` needs no changes.

| Form id      | Frontend                                     | `FORMS` value    | Production recipient                                   |
| ------------ | -------------------------------------------- | ---------------- | ------------------------------------------------------ |
| `contact`    | `apps/web/src/pages/kontakt.astro`           | `CONTACT`        | `kontakt@kirche-felsengrund.ch`                        |
| `counseling` | `apps/web/src/pages/lebensberatung.astro`    | `CONSOLING`      | `lebensberatung@kirche-felsengrund.ch`                 |
| `prayer`     | `index.astro`, `jetzt-fuer-mich-beten.astro` | `PRAYER_REQUEST` | `gebetsanliegen@kirche-felsengrund.ch`                 |
| `feedback`   | `index.astro` ("Parkplatz")                  | `UNSPECIFIED`    | `kontakt@kirche-felsengrund.ch` (no dedicated mailbox) |

### `NotificationService` (`apps/api/src/lib/notification/mail.ts`)

`forms.ts` builds one `NotificationService` at module scope (its SMTP config doesn't depend
on a request, so it's shared across requests rather than re-created per call).
`send(subject, content, form, env, options)` then:

- Sends over SMTP via [`worker-mailer`](https://www.npmjs.com/package/worker-mailer) to
  `mail.webkeeper.ch:465` (implicit TLS), authenticating as a dedicated
  `noreply@kirche-felsengrund.ch` mailbox — kept separate from the human-read `info@` inbox
  specifically so its password can live in a Cloudflare secret without exposing the shared
  inbox's credentials. `authType: ['plain', 'login']` is required explicitly: `worker-mailer`
  only tries the auth methods it's told to, and throws "No supported auth method found"
  otherwise even with valid credentials. See [`docs/deployment.md`](./deployment.md) for the
  `KFA_MAIL_PASSWORD` secret setup.
- **Redirects every notification in any non-`production` environment** (`local`,
  `development`) to the inbox in the `KFA_DEV_NOTIFICATION_RECIPIENT` secret instead of the table above
  (if it isn't set, non-production sends are skipped with a warning — they never fall back to a real mailbox), so local dev and staging
  never reach the church's real mailboxes. The redirected email also gets a
  `[environment]` subject prefix and a visible banner naming the mailbox it would've gone to
  in production.
- Sets `reply` to the form submitter's name/email (where available), so staff can hit
  "Reply" in their mail client and land directly on the person who submitted the form.

### Email templates (`apps/api/src/lib/notification/email/`)

A small, dependency-free HTML templating system rather than a full templating engine:

- `theme.ts` — brand tokens mirrored from `apps/web`'s Tailwind `@theme` block in
  `src/styles/global.css` (colors, and the Raleway/Open Sans font pairing loaded via Google
  Fonts), so notification emails look like they came from the same church.
- `escape-html.ts` — escapes every user-submitted field value before it's interpolated into
  HTML. Form input is untrusted; nothing from a submission is ever inserted raw.
- `layout.ts` — the shared table-based email shell (logo-free, text-based header — images are
  blocked by default in most mail clients, so nothing depends on one loading).
- `notification-email.ts` — renders a heading, optional intro, a label/value fields table, and
  a highlighted message card from structured content.

The layout is hardened for the real differences between Outlook (desktop, Word rendering
engine) and Gmail/Google Workspace rather than assuming one CSS approach works everywhere:

- XHTML 1.0 Transitional doctype, which is what puts Outlook's Word engine into the box
  model its table/padding code expects.
- An MSO "ghost table" (`<!--[if mso]>...<![endif]-->`) wrapping the 600px card: Outlook
  ignores `max-width` entirely, so it gets an explicit fixed-width table, while Gmail/Apple
  Mail/mobile clients (which ignore MSO conditional comments) see the fluid, responsive one.
- `bgcolor` HTML attributes alongside every CSS `background-color` — older Outlook reads the
  legacy attribute more reliably than CSS for cell backgrounds.
- `mso-line-height-rule: exactly` on custom-line-height text, so Outlook doesn't pad out line
  spacing on its own.
- `<meta name="format-detection" content="telephone=no, date=no, address=no, email=no">` —
  without it, iOS Mail and the Gmail Android app auto-detect the raw email/phone values in
  the fields table and re-style them as blue underlined links, clashing with the design.
- Inline styles are the source of truth on every element; the `<style>` block in `<head>` is
  progressive enhancement only (fonts, the responsive media query), since Gmail strips
  `<style>` blocks in some contexts — the layout still holds together without it.
