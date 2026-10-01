import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));

// Fully static site; no adapter, no server runtime. All content that used to be read
// server-side from R2 (offers, podcast episodes, the nav dropdown) is now fetched client-side
// from the Cloudflare Worker API at PUBLIC_API_BASE_URL. See apps/api for that backend.
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
  },
});
