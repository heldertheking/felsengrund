import { hc } from 'hono/client';
import type { AppType } from './index';

/**
 * Pre-computes the client type at declaration-emit time (Hono's recommended `hcWithType` pattern),
 * so `apps/web` doesn't have to re-instantiate every route type in the editor.
 * Type-only: nothing in this file is bundled into the Worker.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- only needed for its type below
const client = hc<AppType>('');
export type Client = typeof client;
