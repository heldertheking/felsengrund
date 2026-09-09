// Single source of truth for the backend origin — every client-side fetch in this app goes
// through here so PUBLIC_API_BASE_URL only has to be wired up in one place.
export const API_BASE_URL = import.meta.env.PUBLIC_API_BASE_URL

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`
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

// Wraps fetch for authenticated /admin/* calls: attaches the bearer token and throws with the
// server's error message (if any) on a non-2xx response, so callers can just await + catch.
export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getAdminToken()
  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(apiUrl(path), { ...init, headers })
  if (response.status === 401) {
    clearAdminToken()
  }
  return response
}
