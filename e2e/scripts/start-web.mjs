// Builds the site against the test Worker and serves the build. Started by Playwright's `webServer`.
// `PUBLIC_API_BASE_URL` is inlined at build time, so it has to be set for the build.
//
// The build is served by a small static server instead of `astro preview` for two reasons: production runs behind
// Apache, whose `.htaccess` rewrites slug URLs to the static detail shells (`astro preview` knows nothing of that),
// and recent Astro versions detach `astro preview` into the background when they detect an AI agent, which leaves
// a server behind after the run.
import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { API_URL, ROOT_DIR, WEB_PORT } from '../env.mjs';

const astro = join(ROOT_DIR, 'node_modules', 'astro', 'bin', 'astro.mjs');
const webDir = join(ROOT_DIR, 'apps', 'web');
const distDir = join(webDir, 'dist');

const build = spawnSync(process.execPath, [astro, 'build'], {
  cwd: webDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    PUBLIC_API_BASE_URL: API_URL,
    // Without it the agenda page renders its own list of events instead of an embedded calendar.
    GOOGLE_CALENDAR_EMBED_URL: '',
    ASTRO_TELEMETRY_DISABLED: '1',
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

/** The rewrites of apps/web/public/.htaccess; they only apply when no real file or directory matches. */
const REWRITES = [
  [/^\/angebote\/[a-z0-9-]+\/?$/, '/angebote/detail/index.html'],
  [/^\/podcast\/[a-z0-9-]+\/?$/, '/podcast/detail/index.html'],
  [/^\/admin(\/.*)?$/, '/admin/index.html'],
];

function resolveFile(pathname) {
  const path = normalize(join(distDir, decodeURIComponent(pathname)));
  if (!path.startsWith(distDir)) return null;
  if (existsSync(path) && statSync(path).isFile()) return path;
  const index = join(path, 'index.html');
  if (existsSync(index)) return index;
  return null;
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  let file = resolveFile(pathname);
  let status = 200;
  if (!file) {
    const rewrite = REWRITES.find(([pattern]) => pattern.test(pathname));
    file = rewrite ? resolveFile(rewrite[1]) : null;
  }
  if (!file) {
    file = join(distDir, '404.html');
    status = 404;
  }
  response.writeHead(status, { 'Content-Type': MIME_TYPES[extname(file)] ?? 'application/octet-stream' });
  response.end(await readFile(file));
});

server.listen(WEB_PORT, '127.0.0.1');
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
