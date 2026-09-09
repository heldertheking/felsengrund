# Deployment

The site is split into two independently deployed halves:

- **`apps/api`** — a plain Cloudflare Worker (Hono, no Astro) that is a pure JSON API: form
  relay, offers/podcast content, media streaming, and the admin CMS's backend. Content
  (offers, podcast episodes, and their media) lives in a Cloudflare R2 bucket rather than in
  the repo.
- **`apps/web`** — a fully static Astro site (public pages + the `/admin` CMS UI) that calls
  `apps/api` over `fetch()` from the browser. It has no server runtime of its own and is
  deployed to webkeeper.ch (a Plesk-managed host) rather than Cloudflare.

## `apps/api` — Cloudflare Worker

### Prerequisites

- A Cloudflare account, with Wrangler authenticated: `wrangler login`.

### The R2 bucket

`apps/api/wrangler.jsonc` declares one R2 binding (`STORAGE` → `felsengrund-storage`), which
must exist before the API will work:

```sh
wrangler r2 bucket create felsengrund-storage
```

See [`docs/architecture.md`](./architecture.md) for the full content model and key layout
(`offers/<slug>.mdoc`, `podcast/<slug>.mdoc`, plus their media under `images/`). A plain R2
binding is only reachable from within the Worker — `apps/api`'s `GET /media/*` route is the
only thing that ever serves those bytes over HTTP, streaming straight off the binding with
`Range` support for podcast audio scrubbing.

### Secrets

```sh
wrangler secret put ADMIN_UPLOAD_PASSWORD
wrangler secret put N8N_WEBHOOK_SECRET
```

- **`ADMIN_UPLOAD_PASSWORD`** — gates `/admin/login`, which returns a signed bearer token on
  success (see [`docs/architecture.md`](./architecture.md) for the token-based admin auth
  model — there is no cookie anymore, since the admin UI is served from a different origin
  than the API).
- **`N8N_WEBHOOK_SECRET`** — HMAC-SHA256 key used to authenticate outgoing webhook calls to
  n8n on form submission (`packages/shared/src/notify.ts`).

For local development, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`.

### Plain vars

`apps/api/wrangler.jsonc` also declares:

- **`N8N_WEBHOOK_URL`** — the target n8n webhook. Replace the committed placeholder
  (`REPLACE-ME.n8n.cloud`) with the real workflow URL before forms will deliver anywhere.
- **`PUBLIC_WORKER_ORIGIN`** — this Worker's own public URL (e.g. its `*.workers.dev`
  address, or a custom domain if one is attached later). Used to rewrite relative
  `/media/<key>` references in API responses into absolute URLs the cross-origin frontend
  can load directly.
- **`ALLOWED_ORIGINS`** — comma-separated list of origins allowed to call this API
  (CORS). Must include whatever origin `apps/web` is actually served from (webkeeper.ch's
  domain in production, `http://localhost:4321` for local dev).

### Build & deploy

Manual: `npm run build:api` (workspace script) or `cd apps/api && wrangler deploy`.

**Recommended for ongoing deploys**: connect this repo to Cloudflare **Workers Builds**
(Cloudflare dashboard → Workers & Pages → this Worker → Settings → Builds) with:
- Root directory: `apps/api` — **not** `/`. This is what tells Wrangler where to find
  `wrangler.jsonc`; with the root directory left at `/`, the deploy/version commands below
  run from the repo root instead and fail to find it. Cloudflare's monorepo support still
  runs the initial `npm install` at the actual repo root first (so the `@felsengrund/shared`
  workspace dependency resolves correctly) before `cd`-ing into this root directory for the
  build/deploy/version commands.
- Build command: `npm run build` (runs `tsc --noEmit` as a pre-deploy type-check gate —
  Wrangler bundles the Worker itself during deploy/versions-upload, so there's no separate
  compile artifact to produce)
- Deploy command: `npx wrangler deploy`
- Version command (for preview/non-production branches): `npx wrangler versions upload`
- Build watch paths — once root directory is `apps/api`, use `src/**` (there's no `dist/`
  here; nothing in this Worker writes one)

This auto-deploys on every push to the configured branch, with no `CLOUDFLARE_API_TOKEN`
needing to live in GitHub.

## `apps/web` — static site on webkeeper.ch

### Env

`apps/web/.env` (copy from `.env.example`) needs `PUBLIC_API_BASE_URL` set to the deployed
`apps/api` Worker's URL. This is a public, non-secret value — Astro inlines it into the
client bundle at build time.

### Build

```sh
npm run build:web   # -> apps/web/dist/
```

This is a plain static build — no Cloudflare tooling involved. `apps/web/dist/` is the
entire deployable artifact: upload/sync it as-is to webkeeper.ch's document root.

### Auto-deploy via GitHub Actions + Plesk Git

`.github/workflows/deploy-web.yml` builds `apps/web` on every push to `master` and
force-pushes the built `dist/` contents to a dedicated `deploy/webkeeper` branch (via
`peaceiris/actions-gh-pages`), so that branch's root **is** the static site — ready for a
host with no Node runtime of its own.

Before this works:
1. In the GitHub repo's **Settings → Secrets and variables → Actions → Variables**, add
   `PUBLIC_API_BASE_URL` set to the production `apps/api` URL.
2. In Plesk (webkeeper.ch), for the `kirche-felsengrund.ch` subscription, add this GitHub
   repo as a Git pull source, tracking the `deploy/webkeeper` branch, with the document root
   set to that repo's checkout root.
3. Configure auto-deploy: if the installed Plesk Git extension version supports
   webhook-triggered pulls, paste its webhook URL into the GitHub repo's
   **Settings → Webhooks** (content type `application/json`, trigger on `push`). If not,
   fall back to a scheduled Plesk cron task running a Git pull periodically. **Verify which
   is available on webkeeper.ch's specific Plesk version** — this is the one piece of the
   pipeline that depends on infrastructure only reachable from the Plesk control panel.

## CORS

`apps/api`'s `ALLOWED_ORIGINS` var must list every origin that's allowed to call it —
production webkeeper.ch domain, plus any staging subdomain used during testing, plus
`http://localhost:4321` for local `astro dev`. A mismatch here shows up as CORS errors in the
browser console, not as a server-side error — check this first if requests from `apps/web`
start failing after a domain change.
