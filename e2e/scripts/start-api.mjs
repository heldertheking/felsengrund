// Starts the real Worker (`wrangler dev`) for the E2E run: its own ports, its own throwaway R2 state,
// fake secrets and a Worker config that cannot send mail. Started by Playwright's `webServer`.
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ADMIN_PASSWORD,
  API_LOG,
  API_PORT,
  API_URL,
  INSPECTOR_PORT,
  MAIL_PASSWORD,
  ROOT_DIR,
  STATE_DIR,
  WEB_URL,
} from '../env.mjs';

// A developer's own dev vars must not leak in (a recipient would enable mail, a worker origin would point media at
// another port). Every variable such a file may define is overridden with `--var` below, which wins over the file
// (verified in tests/dev-vars.spec.ts). Only the existence is checked here, never the contents.
const apiDir = join(ROOT_DIR, 'apps', 'api');
for (const name of ['.dev.vars', '.env']) {
  if (existsSync(join(apiDir, name))) {
    console.warn(`WARNING: apps/api/${name} present, ignored: overridden by --var for the E2E Worker.`);
  }
}

rmSync(STATE_DIR, { recursive: true, force: true });
mkdirSync(dirname(API_LOG), { recursive: true });
const log = createWriteStream(API_LOG);

const vars = {
  // Not "production": the NotificationService only sends mail there. Outside production it sends to
  // KFA_DEV_NOTIFICATION_RECIPIENT and, when that is empty, skips sending altogether (no SMTP connection).
  ENVIRONMENT: 'local',
  KFA_DEV_NOTIFICATION_RECIPIENT: '',
  KFA_MAIL_PASSWORD: MAIL_PASSWORD,
  KFA_ADMIN_PASSWORD: ADMIN_PASSWORD,
  KFA_ALLOWED_ORIGINS: WEB_URL,
  // Media URLs are built from these; keep them on the test stack instead of the deployed Worker.
  KFA_WORKER_ORIGIN: API_URL,
  KFA_WEBPAGE_ORIGIN: WEB_URL,
  KFA_SESSION_TTL_MS: '43200000',
};

const args = [
  join(ROOT_DIR, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
  'dev',
  '--ip',
  '127.0.0.1',
  '--port',
  String(API_PORT),
  '--inspector-port',
  String(INSPECTOR_PORT),
  '--persist-to',
  STATE_DIR,
  ...Object.entries(vars).flatMap(([key, value]) => ['--var', `${key}:${value}`]),
];

const child = spawn(process.execPath, args, {
  cwd: join(ROOT_DIR, 'apps', 'api'),
  env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: process.env.CI ?? '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
}

const stop = () => child.kill();
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));
