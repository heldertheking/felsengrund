# Plan: Dynamic Offers + Simple Admin

> Status: **implemented** (see `CLAUDE.md`'s "Admin & offers" section for the current shape).
> Kept here as the design record this was built from.

## Context

The site currently has a broken worker (`src/worker/index.ts` doesn't compile), a stubbed public
"Angebote" page, and an empty offer-editing page. The goal now is to make offers ("Angebote") real
and dynamic, with a lightweight, single-admin content workflow: no user accounts, no CMS — just a
password gate hidden behind a repeated UI action, a dashboard listing offers, and an editor where
each offer is authored as one markdown file (YAML frontmatter for structured fields + a markdown
body for the description). Public offer reads must be edge-cached for 1h so normal traffic doesn't
hit R2 on every request, while admin writes must invalidate that cache immediately so edits show up
right away.

Decisions confirmed with the user:
- **Offer format**: one markdown file per offer — YAML frontmatter holds every structured field
  (title, schedule, location, organizers, registration, meta); the body below is the description.
  The admin edits this as raw text (with a live preview of the body), not a structured form.
- **Login trigger**: clicking the header logo 5 times within ~2 seconds opens a login modal
  (password only, no username — single admin).

## Architecture

### Shared markdown module
New `src/shared/offerMarkdown.ts` (imported by both client and worker):
- `parseOfferMarkdown(guid: string, raw: string): Offer` — splits on the `---\n...\n---` frontmatter
  delimiter, `js-yaml`-parses the frontmatter into the structured `Offer` fields, and uses the
  remaining body as `description`.
- `serializeOffer(offer: Offer): string` — inverse; `js-yaml`-dumps everything except `description`
  and `guid`/`title`/`intro` as frontmatter (guid/title/intro also go in frontmatter — only the long
  body is prose), followed by `---\n` and the description.
- `blankOfferTemplate(guid: string): string` — starter markdown for "new offer".

Add `js-yaml` (+ `@types/js-yaml`) to `package.json` — pure JS, works in both the Vite client bundle
and the Workers bundle.

### Types (`src/types/`)
- `types.ts`: add `OfferSummary` (guid, title, intro, image/cardImage, schedule.displayTime,
  offeredFrom/Until, updatedAt) — the shape stored in the manifest and served by the public list API.
- `env.ts`: add `ADMIN_PASSWORD: string` and `AUTH_SECRET: string` (Worker secrets, not vars).

### Worker (`src/worker/`)
- `auth.ts` — stateless cookie session, no KV needed:
  - `createSessionToken(env)` → `base64url(payload).base64url(HMAC-SHA256(payload, AUTH_SECRET))`,
    payload = `{ exp }` (~12h).
  - `verifySessionToken(token, env)` validates signature + expiry.
  - `isAuthenticated(request, env)` reads the `session` cookie and verifies it.
  - Cookie flags: `HttpOnly; Secure; SameSite=Strict; Path=/`.
- `cache.ts` — thin wrapper around the Cache API (`caches.default`):
  - `cachedJson(request, ttlSeconds, loader)`: check `caches.default.match(request)`; on miss call
    `loader()`, store the response with `Cache-Control: public, max-age=<ttl>`, return it.
  - `purge(urls: string[])`: `caches.default.delete(...)` for the given absolute URLs — called after
    every admin write so edits are visible immediately instead of waiting out the 1h TTL.
- `offerStore.ts` — replaces the current ad-hoc `WorkerOfferRepository`:
  - Offers stored at `offers/<guid>.md` (raw markdown, source of truth).
  - A manifest at `offers/index.json` (array of `OfferSummary`) is read-modified-written on every
    save/delete, so listing never requires enumerating+fetching every offer object from R2.
  - `getOfferRaw(guid)`, `saveOfferRaw(guid, raw)` (parses via `offerMarkdown` to validate + derive
    the summary before writing both the `.md` file and the updated manifest), `deleteOffer(guid)`,
    `listSummaries()`.
  - Keeps `WorkerImageRepository` as-is (already correct) for offer image uploads.
- `index.ts` — rewrite the currently-broken `fetch` handler with real routing:
  - `GET /api/offers` → public, `cachedJson` (1h) over `listSummaries()`.
  - `GET /api/offers/:guid` → public, `cachedJson` (1h) over `parseOfferMarkdown(getOfferRaw(guid))`.
  - `POST /api/auth/login` `{password}` → constant-time compare vs `env.ADMIN_PASSWORD`, sets cookie.
  - `POST /api/auth/logout` → clears cookie.
  - `GET /api/admin/session` → `{authenticated: boolean}` for the frontend to check on load.
  - `GET /api/admin/offers` → auth required, fresh `listSummaries()` (no cache — admin always sees
    latest).
  - `GET /api/admin/offers/:guid` → auth required, raw markdown (guid `"new"` → blank template).
  - `PUT /api/admin/offers/:guid` → auth required, body = raw markdown, saves + `purge()`s the public
    list and detail cache entries for that guid.
  - `DELETE /api/admin/offers/:guid` → auth required, deletes + purges cache.
  - `POST /api/admin/offers/:guid/images` → auth required, delegates to `WorkerImageRepository`.
  - Everything else → `env.ASSETS.fetch(request)` (serves the SPA/static assets, as configured today).

### Client (`src/client/`)
- `contexts/AdminAuthContext.tsx` — `AdminAuthProvider` + `useAdminAuth()`: on mount calls
  `GET /api/admin/session`; exposes `{isAuthenticated, login(password), logout()}`. Wraps `<App/>`
  in `main.tsx` or the top of `App.tsx`.
- `components/admin/LoginModal.tsx` (+ `.module.css`) — password field + submit, calls
  `login()`, closes on success, shows an error on failure.
- `components/admin/useSecretClickTrigger.ts` — small hook: counts clicks, resets after ~2s of
  inactivity, fires a callback at 5 clicks.
- `Header.tsx` — logo `<img>` gets `onClick={trigger}` wired to `useSecretClickTrigger`, opening
  `<LoginModal>` (rendered from a small piece of state in `Header` or lifted to
  `AdminAuthContext` as `showLoginModal`/`openLoginModal()` so any element could trigger it later).
- `offers/admin/OffersAdminPage.tsx` — dashboard: lists offers from `GET /api/admin/offers` (title,
  displayTime, updatedAt), "New offer" button, Edit/Delete per row.
- `offers/admin/OfferEditPage.tsx` — replaces the empty `offers/crud/CreatePage.tsx`. Split view: a
  raw `<textarea>` bound to the full markdown (frontmatter + body) on one side, and a live preview
  of just the body rendered through the already-installed `react-markdown` + `remark-gfm` on the
  other (parsed client-side with the shared `offerMarkdown` module). Save → `PUT`, Delete → `DELETE`,
  both via the admin API; new offers start from `GET /api/admin/offers/new`.
- `offers/page/OffersPage.tsx` — rewritten to fetch `GET /api/offers` and render real cards
  (image, title, intro, `schedule.displayTime`) linking to a detail route.
- `offers/page/OfferDetailPage.tsx` (new) — fetches `GET /api/offers/:guid`, renders the description
  through `react-markdown`/`remark-gfm`, plus schedule/location/organizers/registration.
- `App.tsx` — add routes: `/angebote/:guid` (public detail), `/admin` (dashboard),
  `/admin/offers/:guid` (edit/new). A small `RequireAdmin` wrapper redirects to `/` when
  `useAdminAuth().isAuthenticated` is false (after the initial session check resolves).

### Config
- `.gitignore` — add `.dev.vars` (local secret values for `wrangler dev`, never committed).
- Document in `CLAUDE.md` (brief addendum) that `ADMIN_PASSWORD` / `AUTH_SECRET` must be set via
  `wrangler secret put <NAME>` for deployed environments, and via a local `.dev.vars` file for
  `wrangler dev`.

## Verification

- `npm run dev` (client + worker together): confirm the worker compiles (fixes the current build
  break) and `/` still loads.
- Hit `GET /api/offers` twice in a row and confirm the second response is served from edge cache
  (`cf-cache-status` header / no repeated R2 read) within the 1h window.
- Log in via the hidden trigger (click header logo 5x) → modal appears → wrong password rejected →
  correct password (from local `.dev.vars`) succeeds and `/admin` becomes reachable.
- Create a new offer through `/admin/offers/new`, confirm it appears in `/api/offers` (after cache
  purge) and renders correctly on `/angebote` and `/angebote/:guid`.
- Edit and delete an existing offer, confirming the dashboard, public list, and detail page all
  reflect the change immediately (cache purge working).
- `npm run build` (tsc + vite) passes with no type errors.
