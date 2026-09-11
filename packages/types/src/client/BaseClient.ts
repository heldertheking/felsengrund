export interface ApiClientOptions {
  baseUrl: string
  getToken?: () => string | null
  onUnauthorized?: () => void
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Nicht angemeldet.') {
    super(401, message)
    this.name = 'UnauthorizedError'
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { error?: string } | null
  return data?.error ?? `Fehler ${response.status}`
}

export abstract class BaseClient {
  private readonly baseUrl: string
  private readonly getToken?: () => string | null
  private readonly onUnauthorized?: () => void

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl
    this.getToken = options.getToken
    this.onUnauthorized = options.onUnauthorized
  }

  private url(path: string): string {
    return this.baseUrl + path
  }

  protected publicRequest(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(this.url(path), init)
  }

  protected async publicJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.publicRequest(path, init)
    if (!response.ok) {
      throw new ApiError(response.status, await readErrorMessage(response))
    }
    return (await response.json()) as T
  }

  protected async publicJsonOrNull<T>(path: string, init: RequestInit = {}): Promise<T | null> {
    const response = await this.publicRequest(path, init)
    if (response.status === 404) return null
    if (!response.ok) {
      throw new ApiError(response.status, await readErrorMessage(response))
    }
    return (await response.json()) as T
  }

  protected async authedRequest(path: string, init: RequestInit = {}): Promise<Response> {
    const token = this.getToken?.() ?? null
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const response = await fetch(this.url(path), { ...init, headers })

    if (response.status === 401) {
      this.onUnauthorized?.()
      throw new UnauthorizedError()
    }

    return response
  }

  protected async authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.authedRequest(path, init)
    if (!response.ok) {
      throw new ApiError(response.status, await readErrorMessage(response))
    }
    return (await response.json()) as T
  }
}
