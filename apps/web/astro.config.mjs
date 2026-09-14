import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// Fully static site — no adapter, no server runtime. All content that used to be read
// server-side from R2 (offers, podcast episodes, the nav dropdown) is now fetched client-side
// from the Cloudflare Worker API at PUBLIC_API_BASE_URL. See apps/api for that backend.
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
