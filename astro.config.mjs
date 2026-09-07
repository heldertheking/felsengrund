import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import markdoc from '@astrojs/markdoc'
import keystatic from '@keystatic/astro'
import tailwindcss from '@tailwindcss/vite'
import cloudflare from '@astrojs/cloudflare'

export default defineConfig({
  // Neither the Cloudflare Images binding nor Astro sessions (Cloudflare KV) are used anywhere
  // in this site — all images are plain <img> tags (no astro:assets), and nothing reads/writes
  // session state. Without these, the adapter auto-enables both by default and expects bindings
  // that don't exist in wrangler.jsonc, which was the source of dev-server runtime errors.
  adapter: cloudflare({ imageService: 'passthrough' }),
  session: false,
  integrations: [react(), markdoc(), keystatic()],
  vite: {
    plugins: [tailwindcss()],
  },
})
