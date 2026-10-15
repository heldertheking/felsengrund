# Dependencies

How dependencies are kept up to date, and the constraints that are easy to break.

## How updates arrive

`.github/dependabot.yml` has two entries:

- **npm** (the whole workspace, one root lockfile): at most one PR a week with **all minor and patch updates
  grouped**. Major versions are ignored on purpose (see below). Dependabot's _security_ updates are separate: they
  open as soon as an advisory exists, whatever the grouping or ignore rules say.
- **GitHub Actions**: at most one PR a month for all workflow actions.

Reviewing the weekly PR: CI runs the web and API tests, the E2E suite, the build, CodeQL and Gitleaks, so a green PR is
safe to merge. If one package in the group breaks something, fix or pin that package in the same PR rather than
splitting the group.

## Security alerts

Open alerts are listed under **Security** on GitHub (Dependabot, code scanning, secret scanning). To check locally:

```sh
npm audit
```

The goal is zero without `npm audit fix --force`: that flag installs semver-major changes and can even downgrade a
package (it once suggested `@tailwindcss/typography@0.5.4`). Do not use it; update the package that pulls in the
vulnerable one, or add an `overrides` entry (below).

## Major versions

Dependabot ignores semver-major updates; they are reviewed together in one ticket (see
[#84](https://github.com/heldertheking/felsengrund/issues/84)) a few times a year. Parts that move together:

- **React 19 stack:** `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@astrojs/react` 7, `framer-motion`.
- **TypeScript 7** in every workspace.
- **Vitest 5** (for the API tests): blocked, see below.

## Constraints

These caused real breakage during the 1.2.2 update; keep them in mind before touching the lockfile.

- **The lockfile must work with npm 10.** CI uses Node 22 and therefore npm 10, while a current development machine
  has npm 11. npm 10 cannot resolve this dependency graph from scratch (it crashes in its peer-dependency resolver
  with `Cannot read properties of null (reading 'edgesOut')`, even for the manifests on `master`); it only works
  because the lockfile is already complete. So:
  - never delete `package-lock.json` or regenerate it from nothing;
  - do not run a blanket `npm update` locally: update one package at a time, and check every step with
    `npx npm@10 ci --dry-run --ignore-scripts` (the real check is `npx npm@10 ci`);
  - Dependabot's lockfile changes are incremental and are vetted by CI, which uses the same npm.
- **The Vitest layout is deliberate.** The root `node_modules` holds Vitest 5 (used by the web tests and by
  `@testing-library/jest-dom`, which finds `vitest` as a peer from the root) and `apps/api` has its own Vitest 4
  because `@cloudflare/vitest-plugin` fails to start with Vitest 5 on Windows (`File path must be a file: URL`),
  although it lists 5 as supported. If a routine update flips which copy is hoisted, the matcher types of the web
  tests break (`toHaveTextContent does not exist ...` in `astro check`). Do not change the layout through a
  blanket update; move the API to Vitest 5 only when the plugin works with it, and then move both together.
- **`overrides` in the root `package.json`:** `@tailwindcss/typography` pins `postcss-selector-parser` to an exact
  vulnerable version (6.0.10) and has no newer release, so the override installs `^7.1.6`. An override only applies
  when the lockfile entry is re-resolved (remove the stale nested entry, then install). The production CSS was
  compared byte for byte before and after. Remove the override once the plugin releases a fix.
- **Node:** `eslint-plugin-astro` 3 needs Node `^22.22.3 || ^24.16.0 || >=26.3.0` (the CI jobs use Node 22, which
  resolves to a matching release) and ESLint 10.
