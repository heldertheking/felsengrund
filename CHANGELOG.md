# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and version numbers loosely follow [Semantic Versioning](https://semver.org/).

> **Note:** version tracking only started with the `1.0.0` release candidate in
> September 2026. Entries before that are reconstructed from git history for
> context, not from actual published version numbers — dates and grouping are
> approximate.

## [Unreleased]

## [1.0.1] - 2026-09-28

### Changed

- `apps/api` worker version bumped to `1.0.1`.

### Added

- Verify required Worker secrets are present before deploying.

## [1.0.0] - 2026-09-28

First tracked release. The project had already been in active use before this
point; this tag marks the switch to explicit version numbers and a CI/CD
pipeline that bumps them automatically.

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

[Unreleased]: https://github.com/heldertheking/felsengrund/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/heldertheking/felsengrund/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/heldertheking/felsengrund/releases/tag/v1.0.0
