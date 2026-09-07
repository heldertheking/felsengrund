/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

// Secrets (wrangler secret put / .dev.vars locally) — deliberately not declared in
// wrangler.jsonc's plaintext `vars`, so `wrangler types` doesn't know about them.
interface Env {
  ADMIN_UPLOAD_PASSWORD?: string
  N8N_WEBHOOK_SECRET?: string
}
