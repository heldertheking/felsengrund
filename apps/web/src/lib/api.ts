import { createApiClient, type ApiClient } from '@felsengrund/types'

// Single source of truth for the backend origin — every client-side fetch in this app goes
// through here so PUBLIC_API_BASE_URL only has to be wired up in one place.
export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL

if (!API_BASE_URL) {
  // Astro inlines PUBLIC_* at build time, so an empty value here means the build itself was
  // misconfigured — locally that's a missing apps/web/.env, in CI it's the PUBLIC_API_BASE_URL
  // repo variable (Settings -> Secrets and variables -> Actions -> Variables). Without this,
  // an empty baseUrl means every request built from it is a root-relative path (e.g. "/nav")
  // that resolves against whatever origin the page is served from instead of the API — every
  // request then 404s against the frontend host instead of reaching the Worker, which is easy
  // to mistake for a routing or CORS problem. Logging loudly here, at module load, catches it
  // immediately.
  console.error(
    '[api] PUBLIC_API_BASE_URL is not set — every API request will be sent to the wrong origin. ' +
      'Local dev: copy apps/web/.env.example to apps/web/.env. ' +
      'CI/prod build: set the PUBLIC_API_BASE_URL repo variable in GitHub Actions.',
  )
}

const TOKEN_STORAGE_KEY = 'felsengrund-admin-token'

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    // localStorage unavailable (private browsing, etc.) — admin session just won't persist.
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // ignore
  }
}

export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL ?? '',
  getToken: getAdminToken,
  onUnauthorized: clearAdminToken,
})
