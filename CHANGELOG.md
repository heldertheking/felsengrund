# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers loosely follow [Semantic Versioning](https://semver.org/).

> **Note:** version tracking only started with the `1.0.0` release candidate in
> September 2026. Entries before that are reconstructed from git history for
> context, not from actual published version numbers — dates and grouping are
> approximate.

## [Unreleased]

## [1.1.0] - 2026-10-01

### Changed

- All public forms now go through one `POST /forms` endpoint (`{ id, payload }`) instead of
  one route per form. The API validates the payload and hands it to a notification layer
  (`apps/api/src/lib/form-notifications.ts`) that translates it into the notification email.
- Forms are registered in a single place, `packages/types/src/Forms.ts` (`FormInputs` +
  `formValidators`); adding a form means one entry there and one in the notification layer.
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
