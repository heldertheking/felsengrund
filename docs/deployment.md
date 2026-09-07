# Deployment

This site deploys to Cloudflare Workers via the `@astrojs/cloudflare` adapter. Content
(offers, podcast episodes, and their media) lives in a Cloudflare R2 bucket rather than in
the repo, so there is a one-time bucket/domain setup in addition to the usual
build-and-deploy steps.

## Prerequisites

- A Cloudflare account.
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) installed (it's already a
  project dependency, so `npx wrangler ...` / `npm run`-based invocations work without a
  separate global install).
- Authenticate Wrangler against the target Cloudflare account: `wrangler login`.

## The R2 bucket

`wrangler.jsonc` declares one R2 binding:

```jsonc
"r2_buckets": [
  { "binding": "STORAGE", "bucket_name": "felsengrund-storage" }
]
```

This bucket must exist in the Cloudflare account you're deploying to before the site will
work. If it doesn't exist yet, create it once with:

```sh
wrangler r2 bucket create felsengrund-storage
```

### What's stored in it

The bucket holds all offer/podcast content and media (see
[`docs/architecture.md`](./architecture.md) for the full content model). The key layout,
as implemented in `src/lib/admin-content.ts`:

- `offers/<slug>.mdoc` — an offer's YAML frontmatter + Markdoc body
- `podcast/<slug>.mdoc` — a podcast episode's YAML frontmatter + Markdoc body
- `podcast/<slug>.<ext>` — that episode's audio file (extension taken from the uploaded file)
- `images/offers/<slug>.<ext>` — an offer's card image
- `images/podcast/<slug>.<ext>` — an episode's cover image

### Public access to the bucket

The public site (offer pages, podcast pages, `<img>`/`<audio>` tags) links to bucket
objects using a same-origin `/media/<key>` path — e.g. `/media/images/offers/<slug>.jpg` —
served by `src/pages/media/[...key].ts`. That route reads the object straight off the
`STORAGE` binding (the same one every other admin/content code path uses) and streams it
back, with `Range` request support for podcast audio scrubbing.

A plain R2 bucket binding is only reachable from within the Worker; it is **not** itself
served over HTTP. Rather than exposing the bucket to the public internet (R2 public bucket
access or a custom domain attached to the bucket), the Worker itself is the only thing that
ever reads from it, so **there is no separate Cloudflare dashboard setup step for media at
all** — no R2 public access toggle, no custom domain to attach. This also means uploads
made through `/admin` while running `npm run dev` are immediately servable locally, since
`STORAGE` resolves to the same local on-disk R2 simulation in both directions (write via the
admin API, read via `/media/*`) — unlike a real public CDN domain, which never sees local
`wrangler dev` state.

## Secrets

Two secrets must be set before the site works correctly. They are deliberately declared as
secrets (`interface Env` in `src/env.d.ts`) rather than plaintext `vars` in
`wrangler.jsonc`, so they aren't committed to the repo. Set each with:

```sh
wrangler secret put ADMIN_UPLOAD_PASSWORD
wrangler secret put N8N_WEBHOOK_SECRET
```

- **`ADMIN_UPLOAD_PASSWORD`** — the single password that gates the entire `/admin` content
  panel (offers, podcast episodes, and their uploads). Despite the name, it is not scoped
  to audio upload only. See [`docs/architecture.md`](./architecture.md) for how the admin
  session built on this password works.
- **`N8N_WEBHOOK_SECRET`** — the HMAC-SHA256 signing key used to authenticate outgoing
  webhook calls to n8n when the site's forms (contact, counseling, feedback, prayer
  request) are submitted. The Worker signs the raw JSON body and sends it as an
  `X-Webhook-Signature` header; the n8n workflow must recompute the same HMAC over the raw
  body and compare it (constant-time) before trusting the payload. See `src/lib/notify.ts`.

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in real values
there instead — `.dev.vars` is gitignored and read automatically by `astro dev` /
`wrangler dev`.

## Plain vars

`wrangler.jsonc` already commits one non-secret var:

```jsonc
"vars": {
  "N8N_WEBHOOK_URL": "https://REPLACE-ME.n8n.cloud/webhook/felsengrund-forms"
}
```

- **`N8N_WEBHOOK_URL`** — the target n8n webhook. The committed value is a placeholder
  (`REPLACE-ME.n8n.cloud`); the comment already in `wrangler.jsonc` calls this out
  explicitly. It is not secret by itself (the `N8N_WEBHOOK_SECRET` signature is what
  authenticates the request), but **it must be replaced with the real n8n workflow's
  webhook URL before the site's forms will actually deliver anywhere**.

## Build & deploy

```sh
npm run build   # runs `astro check && astro build`
wrangler deploy
```

`npm run build` type-checks the project and produces the Worker build output. `@astrojs/cloudflare`
computes the Worker entrypoint and static-assets configuration for you at build time on top
of the bindings/vars already declared in `wrangler.jsonc` — you don't need to hand-add
`main`/`assets` fields yourself, just the project-specific bindings, vars, and secrets
described above (already in place).

There is no separate `deploy` script in `package.json`; run `wrangler deploy` directly
after building.

## Custom domain

Attaching a real custom domain (as opposed to the default `*.workers.dev` URL) to this
Worker is a manual step in the Cloudflare dashboard (Workers & Pages → this Worker →
Domains & Routes, or similar — check the current dashboard, since exact navigation isn't
guaranteed to stay the same). Since media is now served through the Worker itself
(`/media/*`, see above) rather than a separate R2 public domain, this is the only
domain-related setup step left — there's nothing extra to configure for the bucket.
