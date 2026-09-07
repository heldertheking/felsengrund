import { Env } from '../types/env';

const COOKIE_NAME = 'session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12h

function base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify'],
    );
}

async function sign(payload: string, secret: string): Promise<string> {
    const key = await hmacKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    return base64UrlEncode(new Uint8Array(signature));
}

/** Stateless signed session token: base64url(payload).base64url(HMAC-SHA256(payload)). */
export async function createSessionToken(env: Env): Promise<string> {
    const payload = JSON.stringify({ exp: Date.now() + SESSION_TTL_SECONDS * 1000 });
    const encodedPayload = base64UrlEncode(new TextEncoder().encode(payload));
    const signature = await sign(encodedPayload, env.AUTH_SECRET);
    return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string, env: Env): Promise<boolean> {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return false;
    if (signature !== (await sign(encodedPayload, env.AUTH_SECRET))) return false;

    try {
        const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
        return typeof payload.exp === 'number' && payload.exp > Date.now();
    } catch {
        return false;
    }
}

function parseCookies(request: Request): Record<string, string> {
    const header = request.headers.get('Cookie');
    if (!header) return {};
    return Object.fromEntries(
        header.split(';').map((pair) => {
            const [key, ...rest] = pair.trim().split('=');
            return [key, decodeURIComponent(rest.join('='))];
        }),
    );
}

export async function isAuthenticated(request: Request, env: Env): Promise<boolean> {
    const token = parseCookies(request)[COOKIE_NAME];
    if (!token) return false;
    return verifySessionToken(token, env);
}

export function buildSessionCookie(token: string): string {
    return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

export function buildLogoutCookie(): string {
    return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

/** Constant-time string comparison so login doesn't leak the password via response timing. */
export function timingSafeEqual(a: string, b: string): boolean {
    const aBytes = new TextEncoder().encode(a);
    const bBytes = new TextEncoder().encode(b);
    if (aBytes.length !== bBytes.length) return false;
    let mismatch = 0;
    for (let i = 0; i < aBytes.length; i++) mismatch |= aBytes[i] ^ bBytes[i];
    return mismatch === 0;
}
