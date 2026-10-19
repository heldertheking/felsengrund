# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers loosely follow [Semantic Versioning](https://semver.org/).

> **Note:** version tracking only started with the `1.0.0` release candidate in
> September 2026. Entries before that are reconstructed from git history for
> context, not from actual published version numbers; dates and grouping are
> approximate.

## [Unreleased]

## [1.2.4] - 2026-10-19

### Changed

- Updated the repository variables to show navigation controls in the google calendar iframe

## [1.2.3] - 2026-10-19

### Changed

- Grammar and wording pass over the German copy on the home, Über uns and Podcast pages (capitalisation, commas,
  "Die Kirche Felsengrund"), including the "Rückmeldung" checkbox label and the leadership team details.
- Home page: the Über uns teaser now comes before the Gebetsanliegen section, the hero's second button links to
  Über uns instead of Kontakt, and the Gebetsanliegen and Parkplatz section backgrounds are swapped.

### Added

- A note under the Angebote teaser that events usually take place at Felsengrundstrasse 1, 8618 Oetwil am See.

### Fixed

- Dependabot opened the same update once per workspace because the workspaces were listed as extra directories;
  only the root directory is configured now, which updates every workspace in one grouped PR.

## [1.2.2] - 2026-10-15

### Security

- Cleared all open dependency alerts (11 Dependabot alerts, one of them critical) and brought `npm audit` to zero
  without `--force`: `shell-quote` 1.12, `devalue` 5.9.4, `source-map-js` 1.2.2, `smol-toml` 1.9.1,
  `http-cache-semantics` 4.3.0 and `concurrently` 10.0.6 through updates, `braces` by moving to `eslint-plugin-astro`
  3 (a development-only lint chain), and `postcss-selector-parser` through an `overrides` entry for
  `@tailwindcss/typography`, which pins a vulnerable version. The production CSS is byte-identical before and after.
  Code scanning and secret scanning have no open alerts.

### Changed

- Updated dependencies: `hono` 4.13.13, `eslint` 10.12, `prettier` 3.9.10, `typescript-eslint` 8.71, `jsdom`, `yaml`,
  `@types/node` and others, plus `eslint-plugin-astro` 3.2 (needs Node 22.22.3 or 24.16 and newer). `astro`,
  `@astrojs/react` and `zod` follow through Dependabot's weekly PR.
- Dependabot configuration: one npm entry for the whole workspace with all minor and patch updates in a single weekly
  PR, major versions ignored (they are reviewed together, see #84), and a monthly grouped PR for GitHub Actions.
  Before, five separate npm entries produced a PR per package and workspace (19 open at once).

### Added

- `docs/dependencies.md`: how updates arrive, how to handle alerts without `npm audit fix --force`, and the
  constraints that are easy to break (the lockfile must work with npm 10, the Vitest layout, the `overrides` entry).

## [1.2.1] - 2026-10-15

### Security

- The public forms (`POST /forms`) could be used to put extra mail headers into the notification emails: line
  breaks in a single-line field (name, subject, topic) went into the `Subject` / `Reply-To` header unchanged. Those
  fields now refuse line breaks and control characters, have a length limit, and the header values are sanitised
  again where they enter the mailer.
- The endpoint now bounds what it accepts: at most 30 fields (names up to 64 characters), 20 items per repeated
  field and a 32 KB request body (`413`).
- `POST /forms` is rate limited per client (5 requests per 60 seconds, Workers Rate Limiting binding
  `FORMS_RATE_LIMITER`) on deployed environments, so the mailboxes and the SMTP account cannot be flooded. Local
  development, the tests and the E2E suite are not limited.

### Changed

- The email inputs of the contact, prayer and feedback forms use `type="email"`, so browsers check the address before
  sending.

## [1.2.0] - 2026-10-15

### Added

- Admin "Anleitungen" section (`/admin/anleitungen`): walkthrough videos for adding a podcast episode and editing an
  offer (no voice-over: highlights, on-screen captions and music), with the written steps below the video, clickable
  timestamps and a Markdown cheat sheet. Videos and posters ship as static files in `apps/web/public/guides/` (about
  2.8 MB each, served by the web host, not R2).
- Markdown help sidebar on the offer and podcast content editors: click-to-insert formatting at the cursor and
  Ctrl/Cmd+B (bold), I (italic), E (code), K (link) shortcuts; native undo keeps working.
- Training presentation `docs/presentations/admin-anleitung.pptx` (speaker notes contain the step captions).
- Automated tests for the web app (Vitest and Testing Library: lib, React islands, admin forms incl. the Markdown
  editor and guide pages, `BaseForm`) and for the API (Vitest in the Workers runtime: forms, auth, admin routes, feed,
  email escaping). The `test-web` and `test-api` CI jobs now fail a PR when a test fails.
- End-to-end tests (Playwright, `npm run test:e2e`) for all public forms, the public pages and the admin offer and
  episode flows. They run on their own ports with fake credentials and mail disabled, and the new `e2e` CI job must
  pass before either deploy.

### Changed

- Offer and podcast forms now mark required fields with `*` and optional ones with "(optional)", with a note that empty
  optional fields are not shown on the website.
- Admin form controls are linked to their labels (`for`/`id`), which helps screen readers and clicking a label.
- Every `/admin/*` path is now served by the admin app in the dev server too (as `.htaccess` already did in production),
  so admin views have real URLs.
- Development dependencies: `wrangler` 4.151 and `workerd` 1.20261012.1 (pulled in by the Workers test plugin).

### Fixed

- The podcast list crashed for an episode without speakers.
- A malformed JSON body on `POST /forms` returned a 500 instead of a 400.
- The podcast feed description was HTML-escaped twice (`&amp;amp;`).
- The prayer and feedback forms on the home page shared field ids, which left the feedback fields without an
  accessible label.
- The backend tests picked up a developer's local `apps/api/.dev.vars` (real passwords and origins) instead of their
  own fake values and failed on such machines; they now set every value explicitly.

## [1.1.1] - 2026-10-01

### Changed

- Added the `slop/no-em-dash` rule (`eslint-plugin-slop`) to the global ESLint config and removed every em dash
  from code, comments, workflows and docs, rewording the affected sentences.

## [1.1.0] - 2026-10-01

### Changed

- All public forms now go through one `POST /forms` endpoint (`{ id, payload }`) instead of
  one route per form. The API validates the payload and hands it to a notification layer
  (`apps/api/src/lib/form-notifications.ts`) that translates it into the notification email.
- Forms are registered in a single place, `packages/types/src/Forms.ts` (`formSchemas`);
  adding a form means one entry there and one in the notification layer.
- Form validation moved to zod: one schema per form in `packages/types/src/Forms.ts`
  (`formSchemas`) replaces the hand-written input interfaces and validators, the input types are
  inferred from it, and `POST /forms` validates the payload with it. The rules, the 5000 character
  cap, the regex-free email check and the error responses are unchanged. The schemas are only
  exported from `@felsengrund/types/forms`, so zod stays out of the web bundle.
- Form validation failures and unknown form ids return a `createFormError` body; a failed
  notification email returns a `502` form error.
- Counseling form fields `contact-preference` / `counselor-preference` renamed to
  `contactPreference` / `counselorPreference`. The counseling mail now shows readable labels
  and includes the contact method.
- `BaseForm`'s `formId` is typed as `FormId`.
- Refactored `apps/api`: `packages/api-core` was folded into `apps/api/src/lib/`, split into
  `authentication`, `feed`, `media`, `storage` (`OffersRepository`/`PodcastRepository`) and
  `notification` (mail + email templates) modules, exported through a single `lib` barrel.
- Media URL rewriting and Range parsing moved to `lib/media`; the podcast RSS feed builder moved to `lib/feed`.
- Media, offers, podcast and admin routes now return structured errors (`createApiError`).
- `KFA_SESSION_TTL_MS` now controls the admin token lifetime.
- All API errors now use one `{ status, message, meta? }` shape; the web client reads `message`.
- Non-production notification recipient moved from source to the optional `KFA_DEV_NOTIFICATION_RECIPIENT` secret.
- Podcast feed `Last-Modified` is now the newest episode's publish date.
- Admin password check is now constant-time; noisy upload debug logging removed.
- Version bumps: `apps/api` 1.1.0, `apps/web` 1.1.0, `packages/types` 1.1.0.

- `apps/web` now calls the API through Hono's RPC client (`hc`), typed from the API's routes,
  instead of hand-written clients. Route modules in `apps/api` chain their handlers and validate
  input with zod (`@hono/zod-validator`); the admin endpoints keep their German error messages.
  The Worker emits declaration files (`apps/api/tsconfig.build.json`) that the web app imports
  types from, so the site never type-checks the Worker's source. The web `typecheck`/`build`
  scripts emit them first, and `npm run dev` re-emits them on change.
- The deployment pipeline's frontend path filter now includes `apps/api/**`, since API changes
  affect the web client's types.
- The admin form builders (`offerForm`, `podcastForm`) moved to `apps/web/src/lib/admin-forms.ts`
  and are type-checked against the API's schemas.

### Added

- `.github/workflows/release.yml` publishes a GitHub Release from the matching `CHANGELOG.md`
  section when a release lands on `master`, so people can follow releases via Watch -> Custom ->
  Releases or `/releases.atom`. The version comes from the root `package.json`; PRs touching the
  workflow or the changelog run it as a dry run that only prints the notes.

### Fixed

- Podcast RSS feed no longer starts with whitespace before the XML declaration; descriptions and the self-link are escaped and CDATA is safe against `]]>`.
- `@markdoc/markdoc` and `yaml` are declared in `apps/api` (they were only declared by the removed `api-core`).
- Deleting an offer/episode now removes its media from R2.

### Removed

- The hand-written clients (`BaseClient`, `OffersClient`, `PodcastClient`, `NavClient`,
  `AdminClient`, `FormsClient`) and `createApiClient`/`ApiClient` from `@felsengrund/types`, plus the unused
  `SaveResult`, `LoginResult` and `ErrorResponse` types.
- The `POST /contact`, `/counseling`, `/feedback` and `/prayer-request` routes.
- `packages/api-core` workspace package.
- Unused `KFA_NOTIFICATION_WEBHOOK` variable (notifications go out through the email worker now).

## [1.0.1] - 2026-09-28

### Changed

- `apps/api` worker version bumped to `1.0.1`.

### Added

- Verify required Worker secrets are present before deploying.

## [1.0.0] - 2026-09-28

First tracked release. The project had already been in active use before this
point; this tag marks the switch to explicit version numbers (bumped manually
in the `package.json` files) and a CI/CD deployment pipeline.

### Added

- Reworked backend and email notification infrastructure (`apps/api`).
- `GET /` info endpoint on the API worker, surfacing the running version.
- App version shown on the admin login screen and dashboard.
- Deployment pipeline that verifies both the API and the web app are
  reachable after a deploy.
- XML podcast feed (RSS 2.0), with production error-logging fixes.
- Google Calendar-backed agenda.
- Admin dashboard bulk import and Google Maps embed.
- Prettier and ESLint wired into the project, plus JSON Schemas for config
  files.

### Changed

- Split the monorepo into a static frontend (`apps/web`) and a pure JSON API
  worker (`apps/api`), sharing types and core logic via `packages/*`.
- Migrated `apps/web` from a Vite SPA to Astro.
- Reworked breadcrumbs, podcast feature, and contact form.
- Numerous CI/CD, environment, and deployment-target fixes.

## Earlier history (pre-versioning)

Before version numbers were tracked, the project went through:

- An initial Vite-based SPA with Cloudflare Functions for forms/uploads.
- A rework of form submission relaying (n8n instead of Cloudflare Email
  Service).
- An accessibility audit pass and mobile-friendliness pass.
- A full Astro rework of the public site.

See the git history for full detail on this period.

[Unreleased]: https://github.com/heldertheking/felsengrund/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/heldertheking/felsengrund/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/heldertheking/felsengrund/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/heldertheking/felsengrund/releases/tag/v1.0.0
