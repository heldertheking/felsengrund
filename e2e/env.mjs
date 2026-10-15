// Single source of truth for the ports and fake credentials of the E2E stack. Everything is overridable
// through environment variables; the defaults are chosen so they do not collide with `npm run dev`
// (web 4321, api 8787/8788).
import { fileURLToPath } from 'node:url';

const env = process.env;

export const WEB_PORT = Number(env.E2E_WEB_PORT ?? 4400);
export const API_PORT = Number(env.E2E_API_PORT ?? 8790);
export const INSPECTOR_PORT = Number(env.E2E_INSPECTOR_PORT ?? 9330);

// 127.0.0.1 (not "localhost") so Node, Chromium and wrangler all agree on the address family.
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const API_URL = `http://127.0.0.1:${API_PORT}`;

/** Obviously fake; only ever handed to the throwaway local Worker. */
export const ADMIN_PASSWORD = env.E2E_ADMIN_PASSWORD ?? 'e2e-test-admin-password';
export const MAIL_PASSWORD = 'e2e-fake-mail-password-never-used';

export const E2E_DIR = fileURLToPath(new URL('.', import.meta.url));
export const ROOT_DIR = fileURLToPath(new URL('..', import.meta.url));
/** Local R2 state of the test Worker. Wiped on every start, so runs never depend on earlier data. */
export const STATE_DIR = fileURLToPath(new URL('./.state', import.meta.url));
/** Everything the test Worker prints. The mail tests read it to prove nothing was sent. */
export const API_LOG = fileURLToPath(new URL('./.logs/api.log', import.meta.url));
