import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformWithOxc, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'));

const SCRIPT_QUERY = '?astro-script';

/**
 * `.astro` files cannot be rendered outside Astro, but BaseForm's behaviour lives in its inline
 * `<script>`. Importing `Some.astro?astro-script` yields just that script as a TypeScript module
 * (relative imports still resolve from the .astro file, so `vi.mock` works on them).
 */
function astroScript(): Plugin {
  return {
    name: 'astro-inline-script',
    enforce: 'pre',
    async load(id) {
      if (!id.endsWith(`.astro${SCRIPT_QUERY}`)) return null;
      const file = id.slice(0, -SCRIPT_QUERY.length);
      const source = readFileSync(file, 'utf-8');
      // Deliberately strict: a second <script> or one with attributes (is:inline, define:vars) would make
      // this regex extract the wrong block, so fail loudly instead.
      if (/<script\s[^>]*>/.test(source) || (source.match(/<script>/g) ?? []).length > 1) {
        throw new Error(`${file}: expected exactly one plain <script> block (no attributes) for ?astro-script`);
      }
      const match = /<script>([\s\S]*?)<\/script>/.exec(source);
      if (!match) throw new Error(`No inline <script> found in ${file}`);
      const { code } = await transformWithOxc(match[1], `${file}.ts`, { lang: 'ts' });
      return code;
    },
  };
}

export default defineConfig({
  plugins: [astroScript()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.{ts,tsx}'],
    env: { PUBLIC_API_BASE_URL: 'http://api.test' },
    restoreMocks: true,
  },
});
