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

`apps/api/wrangler.jsonc` declares `production` and `development` named environments plus an
unnamed default — each has its **own separate secret store** in Cloudflare, so
`wrangler secret put` warns if you don't pass `--env` and only sets the value for whichever
environment you targeted (or the unnamed default, if you passed none). Set each secret once
per environment you actually deploy to:

```sh
wrangler secret put KFA_ADMIN_PASSWORD --env production
wrangler secret put KFA_ADMIN_PASSWORD --env development
wrangler secret put KFA_MAIL_PASSWORD --env production
wrangler secret put KFA_MAIL_PASSWORD --env development
wrangler secret put KFA_DEV_NOTIFICATION_RECIPIENT --env development
```

- **`KFA_ADMIN_PASSWORD`** — gates `/admin/login`, which returns a signed bearer token on
  success (see [`docs/architecture.md`](./architecture.md) for the token-based admin auth
  model — there is no cookie anymore, since the admin UI is served from a different origin
  than the API).
- **`KFA_MAIL_PASSWORD`** — SMTP password for the dedicated `noreply@kirche-felsengrund.ch`
  mailbox that `apps/api` sends form notification emails from (see
  [`docs/architecture.md`](./architecture.md#forms--notification-emails)). That mailbox must
  already exist in Plesk (webkeeper.ch's mail hosting, `mail.webkeeper.ch`) with this exact
  password set on it — `wrangler secret put` only stores the value Cloudflare-side, it
  doesn't create or configure the mailbox itself. A `535 Authentication failed` error at
  send time almost always means this mailbox doesn't exist yet or the passwords don't match.

- **`KFA_DEV_NOTIFICATION_RECIPIENT`** — optional; the inbox that receives all form notification
  emails in non-`production` environments. Not needed in `production`. If it's unset elsewhere,
  notification emails are skipped with a warning.

For local development, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`.

### Plain vars

`apps/api/wrangler.jsonc` also declares, per environment:

- **`KFA_WORKER_ORIGIN`** — this Worker's own public URL (e.g. its `*.workers.dev`
  address, or a custom domain if one is attached later). Used to rewrite relative
  `/media/<key>` references in API responses into absolute URLs the cross-origin frontend
  can load directly, and to build the podcast RSS feed's (`/podcast/feed.xml`) audio, cover image and self-link URLs.
- **`KFA_WEBPAGE_ORIGIN`** — the deployed `apps/web` origin for this environment (e.g.
  `https://kirche-felsengrund.ch` in production). Used for the podcast feed's website link
  and cover image URL.
- **`KFA_ALLOWED_ORIGINS`** — comma-separated list of origins allowed to call this API
  (CORS). Must include whatever origin `apps/web` is actually served from (webkeeper.ch's
  domain in production, `http://localhost:4321` for local dev).
- **`KFA_SESSION_TTL_MS`** — admin bearer-token lifetime in milliseconds (`43200000` = 12
  hours), read by `POST /admin/login`. Optional: not checked by `env-check.ts`, and login falls
  back to 12 hours if it's missing.

### Build & deploy

Manual: `cd apps/api && wrangler deploy -e production` (Wrangler bundles the Worker directly
on deploy — no separate compile step needed).

**Ongoing deploys** go through `.github/workflows/deployment.yml`'s `deploy-api` job: on every
push to `master` that touches `apps/api/**`, it runs `wrangler deploy -e production` via
`cloudflare/wrangler-action`, authenticating with the `CLOUDFLARE_API_TOKEN` repo secret
(Settings → Secrets and variables → Actions → Secrets — needs Workers Scripts:Edit permission
on the token). It's gated behind `build-api` (typechecks via
`npm run typecheck -w @felsengrund/api`) and `test-api` (runs `npm run test -w @felsengrund/api`
if that script exists yet — otherwise it just warns and passes). Deploy additionally waits for
the `quality` job.

**Pull requests** — every PR, regardless of its target branch, runs `quality` (typecheck, ESLint,
and a non-blocking Prettier check), then build and test for both `apps/web` and `apps/api`, plus
Gitleaks and CodeQL. Nothing deploys from a PR. The path filter only applies to pushes to
`master`, where it decides what gets deployed (changes under `packages/**` count for both, and
changes under `apps/api/**` also count for the web app, because its client is typed from the API).
The web `typecheck` and `build` first emit the API's route declarations, so nothing has to be built
before them.

This replaced the Worker's Cloudflare **Workers Builds** dashboard integration (Workers &
Pages → this Worker → Settings → Builds) — disable/disconnect that if it's still configured,
otherwise both it and this workflow will deploy on the same push.

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

`.github/workflows/deployment.yml` builds `apps/web` on every push to `master` and
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

`apps/api`'s `KFA_ALLOWED_ORIGINS` var must list every origin that's allowed to call it —
production webkeeper.ch domain, plus any staging subdomain used during testing, plus
`http://localhost:4321` for local `astro dev`. A mismatch here shows up as CORS errors in the
browser console, not as a server-side error — check this first if requests from `apps/web`
start failing after a domain change.
