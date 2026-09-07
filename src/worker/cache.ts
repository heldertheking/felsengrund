/**
 * `caches.default` is the Workers-specific edge cache. Cast because the DOM lib's `CacheStorage`
 * type (needed for the client bundle sharing this tsconfig) doesn't declare `default`.
 */
function edgeCache(): Cache {
    return (caches as unknown as { default: Cache }).default;
}

/**
 * Serves a JSON GET route from the Cloudflare edge cache, only calling `loader` on a cache miss.
 * `loader` returns `null` for "not found" so a 404 is never cached (only successful reads are).
 */
export async function cachedJson(request: Request, ttlSeconds: number, loader: () => Promise<unknown | null>): Promise<Response> {
    const cache = edgeCache();
    const cached = await cache.match(request);
    if (cached) return cached;

    const data = await loader();
    if (data === null) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
            status: 404,
            headers: { 'content-type': 'application/json' },
        });
    }

    const response = new Response(JSON.stringify(data), {
        headers: {
            'content-type': 'application/json',
            'cache-control': `public, max-age=${ttlSeconds}`,
        },
    });
    await cache.put(request, response.clone());
    return response;
}

/** Evicts cached responses so admin writes are visible immediately instead of waiting out the TTL. */
export async function purge(urls: string[]): Promise<void> {
    const cache = edgeCache();
    await Promise.all(urls.map((url) => cache.delete(url)));
}
