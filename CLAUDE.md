# Felsengrund

Custom rebuild of the [Kirche Felsengrund](https://www.kirche-felsengrund.ch/) website, replacing the
current WordPress site with a React + Cloudflare Workers app. This is early-stage, work-in-progress
scaffolding — large parts are stubs or unfinished. Treat anything below as the *intended* shape, not
a finished implementation, and verify against the actual files before relying on them.

## Stack

- **Frontend**: React 19, react-router-dom 7, Vite 8, TypeScript (strict), Tailwind CSS 4
  (`@tailwindcss/vite`) mixed with CSS Modules per component.
- **Backend**: Cloudflare Workers (`wrangler`), serving both the API and the built static assets
  (`ASSETS` binding, SPA fallback via `not_found_handling: single-page-application`).
- **Storage**: Cloudflare R2 bucket `felsengrund-storage` (binding `STORAGE`) — no database. Each
  offer is a markdown file (`offers/<guid>.md`, YAML frontmatter + markdown body), plus a manifest
  (`offers/index.json`) for listing without reading every file, plus uploaded images.
- **Auth**: single shared admin password, no user accounts. See "Admin & offers" below.
- **Deploy**: `npm run deploy` (build + `wrangler deploy`), with a `preview` environment
  (`npm run deploy:preview`).

## Repo layout

- `src/client/` — Vite root. React app (`App.tsx`, routes for `/`, `/about`, `/contact`, `/angebote`,
  `/angebote/:guid`, `/admin`, `/admin/offers/:guid`, `/admin/prayer-wall`, `/admin/feedback`).
  - `home/` — `HomePage` (hero + Willkommen + Aktuelle Angebote + Gebetswand + Parkplatz + Über-uns
    teaser + Hilfe & Service + footer), `PrayerWallForm`, `FeedbackForm`.
  - `components/layout/Header/` — main site nav, mirrors the real site's menu structure (see below).
    The logo also doubles as the hidden admin-login trigger (see below).
  - `components/ui/` — shared UI primitives (e.g. `Dropdown`).
  - `components/admin/` — `LoginModal`, `RequireAdmin` (route guard + the shared admin nav shell —
    Angebote / Gebetswand / Parkplatz / Abmelden), `useSecretClickTrigger`.
  - `contexts/AdminAuthContext.tsx` — `AdminAuthProvider`/`useAdminAuth()`, wraps the whole app.
  - `offers/page/` — public pages: `OffersPage` (list) and `OfferDetailPage` (single offer, renders
    `description` through `react-markdown` + `remark-gfm`).
  - `offers/admin/` — `OffersAdminPage` (dashboard) and the offer editor: `OfferEditPage` (data
    loading/saving) rendering `OfferForm` (the actual fields), `ImageUploadField` (reusable image
    upload widget, used for the main/card image and gallery), `OrganizerFields` (repeatable rows),
    `datetimeLocal.ts` (ISO ⇄ `<input type="datetime-local">` conversion).
  - `admin/SubmissionsAdminPage.tsx` — lists/deletes Gebetswand or Parkplatz entries (parameterized
    by `title`/`path`), used for both `/admin/prayer-wall` and `/admin/feedback`.
  - `assets/icons/` — SVG logo variants (standard, vertical, negative, single-line, etc.).
  - `assets/images/` — real photos from the church's own site (banner, Dinner Church, Gebetswand,
    Parkplatz, leadership team) plus legacy logo rasters — see "Theme & imagery" below.
  - `index.css` — design-system tokens as CSS custom properties, namespaced `--kf-*` (colors, fonts,
    shadows, radius, nav/dropdown sizing). Dark mode variables exist but are commented out/TODO.
- `src/worker/` — Worker entrypoint and supporting modules:
  - `index.ts` — routing for `/api/offers*` (public), `/api/auth/*`, `/api/prayer-wall`,
    `/api/feedback`, `/api/admin/*`.
  - `auth.ts` — stateless HMAC-signed session cookie (no KV/sessions table).
  - `cache.ts` — wraps the Workers edge cache (`caches.default`) for the public offer reads.
  - `offerStore.ts` — `OfferStore`, the R2-backed `IOfferRepository` implementation (markdown files
    + manifest). `WorkerImageRepository` (image uploads) still lives in `index.ts`.
  - `submissionStore.ts` — `SubmissionStore` (parameterized by `'prayer' | 'feedback'`), R2-backed,
    no manifest/caching (low-volume, admin-read-only — `bucket.list()` is enough).
- `src/shared/offerMarkdown.ts` — parse/serialize an `Offer` to/from its raw markdown-with-frontmatter
  form (`js-yaml`). Imported by both the client (`OfferEditPage` load/save) and the worker
  (validation on save).
- `src/types/` — types shared between client and worker:
  - `types.ts` — the `Offer` domain model (title, intro, description, `schedule`, `location`,
    `organizers[]`, `registration`, `meta` incl. `targetAudience`, image/gallery paths, etc.),
    `OfferSummary` (the manifest/list-view projection), and `Submission`/`SubmissionCategory`
    (Gebetswand/Parkplatz entries).
  - `repositories.ts` — `IOfferRepository` / `IImageRepository` interfaces. Offers are stored at
    `offers/<guid>.md` in R2; images at `offers/<guid>/<imageGuid>.<ext>`, served publicly through
    the `PUBLIC_CDN_DOMAIN` env var.
  - `env.ts` — Worker `Env` bindings (`ASSETS`, `STORAGE`, `ENVIRONMENT`, `PUBLIC_CDN_DOMAIN`,
    `ADMIN_PASSWORD`, `AUTH_SECRET`).

## Admin & offers

- **Login**: no visible login page. Clicking the header logo 5 times within ~2 seconds opens a
  password modal (`useSecretClickTrigger` + `LoginModal`). On success the worker sets an `HttpOnly`,
  signed session cookie (~12h TTL, HMAC-SHA256 via `AUTH_SECRET`, no server-side session storage).
- **Secrets required**: `ADMIN_PASSWORD` and `AUTH_SECRET`. For `wrangler dev`, copy
  `.dev.vars.example` to `.dev.vars` (gitignored). For deployed environments, set both with
  `wrangler secret put ADMIN_PASSWORD` / `wrangler secret put AUTH_SECRET`.
- **Editing model**: an offer is authored via a real form (`OfferForm`) — title, intro, schedule,
  location, registration, target audience, and repeatable organizer rows are proper fields; only the
  long description is a markdown textarea with a live `react-markdown` preview. `guid`,
  `meta.createdAt`, and `meta.updatedAt` are never shown/editable — `createdAt` is preserved and
  `updatedAt` is always server-stamped on save (`OfferStore.saveOfferRaw`). Under the hood the form
  still round-trips through `serializeOffer()`/`parseOfferMarkdown()` (`src/shared/offerMarkdown.ts`)
  to the same markdown-file storage — the backend didn't change when the editor became a form.
- **Images**: `ImageUploadField` uploads directly to `POST /api/admin/offers/:guid/images` (a `File`
  works as-is as the fetch body) and writes the returned CDN URL into form state. Used for the main
  image, `meta.cardImage`, and the gallery (multi-upload with per-item remove). Works for brand-new
  offers too since `GET /api/admin/offers/new` mints the guid before the first save.
- **Gebetswand & Parkplatz**: real public forms on the homepage (`PrayerWallForm`/`FeedbackForm`) post
  to `/api/prayer-wall` / `/api/feedback` (`SubmissionStore`, `src/worker/submissionStore.ts`).
  Prayer-wall entries carry an `isAnonymous` flag (for the admin's own reference — nothing is ever
  displayed publicly). Admin can review/delete entries at `/admin/prayer-wall` and `/admin/feedback`.
- **Caching**: `GET /api/offers` and `GET /api/offers/:guid` are cached at the edge for 1h
  (`cachedJson` in `src/worker/cache.ts`) so normal traffic doesn't hit R2 per request. Every admin
  write (`PUT`/`DELETE` under `/api/admin/offers/:guid`) purges the corresponding cache entries so
  edits are visible immediately rather than waiting out the TTL. `GET /api/admin/offers*` and the
  submissions endpoints are never cached (low-volume, always-fresh admin reads).
- See `OFFERS_ADMIN_PLAN.md` for the full design writeup this was implemented from.

## Theme & imagery

- The `--kf-*` color tokens in `index.css` are the **real** brand palette, reverse-engineered from
  the live site's compiled theme CSS (`wp-content/uploads/fusion-styles/*.min.css`): deep magenta
  `#a31366` as `--kf-brand-accent` (matches the logo's pink cross; used for links/buttons/hover),
  soft pink `#fda1d5` as `--kf-clr-pink-100`/`--kf-brand-accent-soft`. Fonts (Open Sans body /
  Raleway display) were already correct and are unchanged.
- `src/client/assets/images/{dinnerchurch,gebet,parkplatz,leiter}.jpg` are real photos downloaded
  from the church's own live site (their own assets, reused for rebuilding their own site) —
  `leiter.jpg` was downscaled from ~4.3MB to a web-friendly ~300KB with `sharp`. `banner.webp` (the
  rock/hiker hero photo) was already in the repo and fits the "Felsengrund" (rock-foundation) theme.
- Deliberately **no Google Maps imagery/embeds** — `Offer.location.mapsLink` (a plain link) is the
  only "where to find us" mechanism, to avoid third-party image licensing questions entirely.

## Current state / known gaps

- `AboutPage`, `ContactPage` in `App.tsx` are still one-line placeholders (`/uber-uns`, `/gottesdienst`,
  `/agenda`, `/kontakt` etc. referenced from nav/homepage links aren't routed yet — only `/about`,
  `/contact`, `/angebote*`, `/admin*` exist as real routes today).
- `src/client/assets/json/jungschar.json` is a sample/fixture `Offer` object (old JSON shape, not
  the current markdown format), useful as a content reference but not wired to anything.
- No brute-force/rate-limiting protection on `/api/auth/login`, `/api/prayer-wall`, or `/api/feedback`
  — acceptable for a single-admin, low-traffic site, but worth knowing if this ever needs hardening.
- Git history is essentially just `Initial commit` + `Reset State to old Repo` — don't assume any
  deeper history exists.

## Reference site (what we're rebuilding)

Live WordPress site: https://www.kirche-felsengrund.ch/ (Avada/Fusion theme). Key things matched:

- **Nav** (already reflected in `Header.tsx`): Home, Über uns, Agenda, and an "Angebote" dropdown
  grouped by category — Gottesdienst (incl. external link to Dinner Church at dinnerchurch.ch,
  Podcast), Kinder & Jugend (Kids-Treff, Jungschar, Highlight), Gemeinschaft (Smallgroups/Hauskreise,
  Bibel Unterricht), Senioren (Senioren, Senioren Essen 60+), Hilfe & Service (Lebensmittelabgabe,
  Ich brauche Hilfe), and Human Flourishing — then Kontakt & Spenden.
- **Homepage** (implemented in `HomePage.tsx`): welcome/service-times section (Sunday worship ~9:45,
  monthly Dinner-Church evenings), "Gebetswand" (prayer wall) and "Parkplatz" (sermon feedback) as
  real submission forms, an Aktuelle-Angebote teaser, an Über-uns/Leitung teaser, and a Hilfe &
  Service section. Seasonal event flyers from the live site were not carried over (no admin UI
  for arbitrary homepage flyers yet — would need its own feature if wanted).
- Social ministry focus: food bank (Lebensmittelabgabe), senior meals, "Ich brauche Hilfe" support page.
- Has GDPR cookie consent and a Datenschutz (privacy policy) page — not yet replicated.

When implementing further "Angebote" content/pages, the real site's per-category structure above is
the source of truth for what categories and offers should exist.

## Conventions

- Component styling: CSS Modules (`Component.module.css`) for structural/component styles, Tailwind
  utility classes for one-offs, shared design tokens via the `--kf-*` CSS variables in `index.css`.
- Shared domain types live in `src/types/` and are imported by both `src/client` and `src/worker` —
  keep them framework-agnostic (no React or Workers-specific types in there).
