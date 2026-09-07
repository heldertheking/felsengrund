/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// ADMIN_UPLOAD_PASSWORD is a secret (wrangler secret put / .dev.vars locally) — deliberately
// not declared in wrangler.jsonc's plaintext `vars`, so `wrangler types` doesn't know about it.
interface Env {
  ADMIN_UPLOAD_PASSWORD?: string
}
