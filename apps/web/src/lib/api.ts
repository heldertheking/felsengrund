import { createApiClient, type ApiClient } from '@felsengrund/types';

export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  console.error(
    '[api] PUBLIC_API_BASE_URL is not set — every API request will be sent to the wrong origin. ' +
      'Local dev: copy apps/web/.env.example to apps/web/.env. ' +
      'CI/prod build: set the PUBLIC_API_BASE_URL repo variable in GitHub Actions.',
  );
}

const TOKEN_STORAGE_KEY = 'felsengrund-admin-token';

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage unavailable (private browsing, etc.) — admin session just won't persist.
  }
}

export function clearAdminToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export const apiClient: ApiClient = createApiClient({
  baseUrl: API_BASE_URL ?? '',
  getToken: getAdminToken,
  onUnauthorized: clearAdminToken,
});
