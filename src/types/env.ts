export interface Env {
    ASSETS: Fetcher;
    STORAGE: R2Bucket;
    ENVIRONMENT: string;
    PUBLIC_CDN_DOMAIN: string;
    /** Shared admin password, set via `wrangler secret put ADMIN_PASSWORD`. */
    ADMIN_PASSWORD: string;
    /** HMAC signing key for admin session cookies, set via `wrangler secret put AUTH_SECRET`. */
    AUTH_SECRET: string;
}