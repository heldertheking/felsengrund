import type { Env } from './env';

export default {
  async fetch(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return new Response('felsengrund-api: not yet implemented', { status: 501 });
  },
};
