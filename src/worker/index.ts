import { Env } from '../types/env';

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url);

        // API routes — proxy to R2
        if (url.pathname.startsWith('/api/')) {
            return handleAPI(request, env, url);
        }

        // Everything else — serve static assets (React SPA)
        return env.ASSETS.fetch(request);
    },
};

async function handleAPI(request: Request, env: Env, url: URL): Promise<Response> {
    const key = url.pathname.replace('/api/files/', '').replace('/api/files', '');

    try {
        switch (request.method) {
            case 'GET': {
                if (!key) {
                    // List objects (simple implementation)
                    const list = await env.STORAGE.list({ limit: 100 });
                    return Response.json(list.objects.map(o => o.key));
                }
                const object = await env.STORAGE.get(key);
                if (!object) {
                    return new Response('Not found', { status: 404 });
                }
                return new Response(object.body, {
                    headers: {
                        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
                        'Cache-Control': 'public, max-age=31536000',
                    },
                });
            }

            case 'PUT': {
                const body = request.body;
                if (!body) {
                    return new Response('Bad request', { status: 400 });
                }
                await env.STORAGE.put(key, body, {
                    httpMetadata: {
                        contentType: request.headers.get('content-type') || 'application/octet-stream',
                    },
                });
                return Response.json({ success: true, key });
            }

            case 'DELETE': {
                await env.STORAGE.delete(key);
                return Response.json({ success: true, key });
            }

            default:
                return new Response('Method not allowed', { status: 405 });
        }
    } catch (err) {
        return new Response(`Error: ${err instanceof Error ? err.message : String(err)}`, {
            status: 500,
        });
    }
}
