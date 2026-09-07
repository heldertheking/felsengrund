import { Env } from '../types/env';
import { IImageRepository } from '../types/repositories';
import { SubmissionCategory } from '../types/types';
import { OfferStore } from './offerStore';
import { SubmissionStore } from './submissionStore';
import { buildLogoutCookie, buildSessionCookie, createSessionToken, isAuthenticated, timingSafeEqual } from './auth';
import { cachedJson, purge } from './cache';

function json(data: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers },
    });
}

const unauthorized = () => json({ error: 'Unauthorized' }, { status: 401 });
const notFound = () => json({ error: 'Not found' }, { status: 404 });
const badRequest = (message: string) => json({ error: message }, { status: 400 });

/** Public path segment for each submission category (Gebetswand / Parkplatz). */
const SUBMISSION_ROUTES: { category: SubmissionCategory; path: string }[] = [
    { category: 'prayer', path: 'prayer-wall' },
    { category: 'feedback', path: 'feedback' },
];

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);
        const { pathname } = url;
        const method = request.method;

        if (!pathname.startsWith('/api/')) {
            return env.ASSETS.fetch(request);
        }

        const offerStore = new OfferStore(env.STORAGE);
        const imageRepository = new WorkerImageRepository(env.STORAGE, env.PUBLIC_CDN_DOMAIN);

        try {
            // --- Auth ---
            if (pathname === '/api/auth/login' && method === 'POST') {
                const { password } = await request.json<{ password?: string }>();
                if (!password || !timingSafeEqual(password, env.ADMIN_PASSWORD)) {
                    return unauthorized();
                }
                const token = await createSessionToken(env);
                return json({ authenticated: true }, { headers: { 'Set-Cookie': buildSessionCookie(token) } });
            }

            if (pathname === '/api/auth/logout' && method === 'POST') {
                return json({ authenticated: false }, { headers: { 'Set-Cookie': buildLogoutCookie() } });
            }

            if (pathname === '/api/admin/session' && method === 'GET') {
                return json({ authenticated: await isAuthenticated(request, env) });
            }

            // --- Public offers (edge-cached for 1h) ---
            if (pathname === '/api/offers' && method === 'GET') {
                return cachedJson(request, 3600, () => offerStore.listSummaries());
            }

            const publicOfferMatch = pathname.match(/^\/api\/offers\/([^/]+)$/);
            if (publicOfferMatch && method === 'GET') {
                return cachedJson(request, 3600, () => offerStore.getOffer(publicOfferMatch[1]));
            }

            // --- Gebetswand / Parkplatz submissions (public write, admin read/delete) ---
            for (const { category, path } of SUBMISSION_ROUTES) {
                if (pathname === `/api/${path}` && method === 'POST') {
                    const body = await request.json<{ message?: string; name?: string; isAnonymous?: boolean }>();
                    if (!body.message?.trim()) return badRequest('Message is required');
                    const submission = await new SubmissionStore(env.STORAGE, category).create({
                        message: body.message,
                        name: body.name,
                        isAnonymous: body.isAnonymous,
                    });
                    return json(submission, { status: 201 });
                }
            }

            // --- Admin routes (require an authenticated session) ---
            if (pathname.startsWith('/api/admin/')) {
                if (!(await isAuthenticated(request, env))) return unauthorized();

                if (pathname === '/api/admin/offers' && method === 'GET') {
                    return json(await offerStore.listSummaries());
                }

                const adminOfferMatch = pathname.match(/^\/api\/admin\/offers\/([^/]+)$/);
                if (adminOfferMatch) {
                    const guid = adminOfferMatch[1];

                    if (method === 'GET') {
                        if (guid === 'new') {
                            const newGuid = crypto.randomUUID();
                            return json({ guid: newGuid, raw: offerStore.blankTemplate(newGuid) });
                        }
                        const raw = await offerStore.getOfferRaw(guid);
                        return raw === null ? notFound() : json({ guid, raw });
                    }

                    if (method === 'PUT') {
                        const offer = await offerStore.saveOfferRaw(guid, await request.text());
                        await purge([new URL('/api/offers', url).toString(), new URL(`/api/offers/${guid}`, url).toString()]);
                        return json(offer);
                    }

                    if (method === 'DELETE') {
                        await offerStore.deleteOffer(guid);
                        await purge([new URL('/api/offers', url).toString(), new URL(`/api/offers/${guid}`, url).toString()]);
                        return json({ deleted: true });
                    }
                }

                const imageMatch = pathname.match(/^\/api\/admin\/offers\/([^/]+)\/images$/);
                if (imageMatch && method === 'POST') {
                    const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
                    const publicUrl = await imageRepository.uploadImage(
                        imageMatch[1],
                        crypto.randomUUID(),
                        await request.arrayBuffer(),
                        contentType,
                    );
                    return json({ url: publicUrl });
                }

                for (const { category, path } of SUBMISSION_ROUTES) {
                    if (pathname === `/api/admin/${path}` && method === 'GET') {
                        return json(await new SubmissionStore(env.STORAGE, category).list());
                    }

                    const deleteMatch = pathname.match(new RegExp(`^/api/admin/${path}/([^/]+)$`));
                    if (deleteMatch && method === 'DELETE') {
                        await new SubmissionStore(env.STORAGE, category).remove(deleteMatch[1]);
                        return json({ deleted: true });
                    }
                }
            }

            return notFound();
        } catch (error) {
            console.error(error);
            return json({ error: 'Internal error' }, { status: 500 });
        }
    },
};

export class WorkerImageRepository implements IImageRepository {
    constructor(private bucket: R2Bucket, private publicUrlDomain: string) {}

    async uploadImage(offerGuid: string, imageGuid: string, data: Blob | ArrayBuffer, contentType: string): Promise<string> {
        const extension = contentType.split('/')[1] || 'webp';
        const r2Path = `offers/${offerGuid}/${imageGuid}.${extension}`;

        await this.bucket.put(r2Path, data, {
            httpMetadata: { contentType },
        });

        return `${this.publicUrlDomain}/${r2Path}`;
    }

    async deleteImage(offerGuid: string, imageGuid: string, extension: string): Promise<void> {
        await this.bucket.delete(`offers/${offerGuid}/${imageGuid}.${extension}`);
    }
}
