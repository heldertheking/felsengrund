# Felsengrund

The public website for [Kirche Felsengrund](https://www.google.com/maps/search/Kirche+Felsengrund+Oetwil+am+See),
a church in Oetwil am See, Switzerland, plus a small self-service admin panel the church
team uses to manage its own content (offers/"Angebote" and podcast episodes) without
needing a developer for every update.

## Architecture

The project is a monorepo (npm workspaces) split into two independently deployed halves,
a traditional client/API split rather than a single server-rendered app:

- **`apps/web`**: a fully static [Astro 7](https://astro.build/) site (`output: 'static'`,
  no adapter) covering both the public pages and the `/admin` CMS UI. It has no server
  runtime of its own; it's deployed as plain files to webkeeper.ch. Public content (offers,
  podcast episodes) and the admin panel both talk to `apps/api` over `fetch()`.
- **`apps/api`**: a plain [Cloudflare Worker](https://workers.cloudflare.com/) (no Astro),
  using [Hono](https://hono.dev/) for routing. A pure JSON API: form relay to offers/
  podcast content backed by [Cloudflare R2](https://developers.cloudflare.com/r2/), media
  streaming, and the admin CMS's backend (bearer-token auth, not cookies; see
  [`docs/architecture.md`](./docs/architecture.md)).
- **`packages/types`**: shared TypeScript types (offers, podcast episodes, nav, admin,
  forms) used by both `apps/web` and `apps/api`, plus the form registry. `apps/web` calls the
  API through a Hono RPC client typed from the API's routes (see
  [`docs/architecture.md`](./docs/architecture.md#typed-api-client-hono-rpc)), so the two halves
  can't drift apart.
- **`packages/logger`**: a tiny leveled console logger (`createLogger()`) shared across
  `apps/api`'s middleware, routes, and services (request logging, error logging, the mail
  notification service) for consistent, namespaced log output.

Tailwind CSS v4 and React (`@astrojs/react`) are used in `apps/web` for interactive islands,
form components, and the client-fetch-driven offers/podcast/admin views, rather than for
the whole UI.

## Local development

```sh
npm install

cp apps/api/.dev.vars.example apps/api/.dev.vars   # fill in real values, see below
npm run dev:api    # starts apps/api on Wrangler's local dev server

cp apps/web/.env.example apps/web/.env             # point PUBLIC_API_BASE_URL at the above
npm run dev:web    # starts apps/web's Astro dev server
```

`apps/api/.dev.vars` is gitignored and read automatically by Wrangler's dev server. It holds
two secrets (see `apps/api/.dev.vars.example` for the authoritative list and inline notes):

- `KFA_ADMIN_PASSWORD`: the password that gates the `/admin` content panel locally.
- `KFA_MAIL_PASSWORD`: SMTP password for the `noreply@kirche-felsengrund.ch` mailbox that
  form notification emails are sent from (see
  [`docs/architecture.md`](./docs/architecture.md#forms--notification-emails)).

### root npm scripts

| Script                 | What it does                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`          | Starts `apps/web` and `apps/api` dev servers together (via `concurrently`)                    |
| `npm run dev:web`      | Starts `apps/web`'s Astro dev server                                                          |
| `npm run dev:api`      | Starts `apps/api`'s Wrangler dev server                                                       |
| `npm run build:web`    | Type-checks and builds `apps/web` for production                                              |
| `npm run build:api`    | Builds `apps/api` (mainly useful as a pre-deploy check; `wrangler deploy` bundles on its own) |
| `npm run lint`         | Runs ESLint across every workspace                                                            |
| `npm run typecheck`    | Runs each workspace's own typecheck (`astro check` for `apps/web`, `tsc --noEmit` elsewhere)  |
| `npm run format:check` | Checks Prettier formatting across the repo                                                    |
| `npm run format:write` | Applies Prettier formatting across the repo                                                   |
| `npm run check`        | Runs `typecheck`, `lint`, and `format:check` together (what CI runs)                          |

## Content & Admin

Offers and podcast episodes are **not** stored as files in this repo. They live as Markdoc
documents in `apps/api`'s `STORAGE` R2 bucket, fetched by `apps/web` client-side on every
page load; so an edit goes live immediately, with no frontend redeploy.

Content is edited through a password-gated `/admin` panel (a client-rendered React app in
`apps/web`, calling `apps/api`'s `/admin/*` routes with a bearer token). There's no visible
link to it on the public site: click the top-right corner of the header 5 times within about
2 seconds to reveal a discreet "Admin öffnen" link (see `apps/web/src/components/Header.astro`).

For the full content model, the admin panel's routes, and how the token-based auth works,
see [`docs/architecture.md`](./docs/architecture.md).

## Forms & notification emails

The public contact, counseling, feedback, and prayer-request forms all post to a single
`POST /forms` endpoint (`apps/api/src/routes/forms.ts`); each form is registered in
`packages/types/src/Forms.ts` and sends a branded HTML notification email to the relevant church mailbox via a small,
dependency-free email templating system (`apps/api/src/lib/notification/email/`); no external templating
engine, just table-based HTML hardened for both Outlook and Gmail. In any non-`production`
environment, every notification is redirected to a fixed test inbox instead of the real
mailboxes, so local/staging testing never reaches the church's actual inboxes. See
[`docs/architecture.md`](./docs/architecture.md#forms--notification-emails) for the full
routing table and template details.

## Deployment

For setting up the Cloudflare R2 bucket and secrets, deploying `apps/api` to Cloudflare
Workers, and deploying `apps/web` to webkeeper.ch (including the GitHub Actions + Plesk Git
auto-deploy setup), see [`docs/deployment.md`](./docs/deployment.md).

## Contributing

Bug reports, feature suggestions, and translation help are welcome via GitHub
issues; see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for how to get started,
including how to reach us directly if you'd like to help translate the site
into another language. This repository does not accept unsolicited pull
requests or third-party code changes. See also [`CHANGELOG.md`](./CHANGELOG.md)
for a history of releases.

## License

This repository is source-available for transparency, not open source in the permissive
sense. Viewing the code does not grant permission to reuse it: copying, redistributing,
modifying, or using this code or its content (including for AI/ML training, which is
prohibited outright) requires the copyright holder's explicit written permission. See
[`LICENSE`](./LICENSE) for the full terms.

---

[![Deployment](https://github.com/heldertheking/felsengrund/actions/workflows/deployment.yml/badge.svg)](https://github.com/heldertheking/felsengrund/actions/workflows/deployment.yml) [![CodeQL Analysis](https://github.com/heldertheking/felsengrund/actions/workflows/codeql.yml/badge.svg)](https://github.com/heldertheking/felsengrund/actions/workflows/codeql.yml) [![Gitleaks Secret Scan](https://github.com/heldertheking/felsengrund/actions/workflows/gitleaks.yml/badge.svg)](https://github.com/heldertheking/felsengrund/actions/workflows/gitleaks.yml)

[<img alt="Deployed with FTP Deploy Action" src="https://img.shields.io/badge/Deployed With-FTP DEPLOY ACTION-%3CCOLOR%3E?style=for-the-badge&color=0077b6">](https://github.com/SamKirkland/FTP-Deploy-Action)
