import { ApiError, BaseClient } from './BaseClient'

export class AdminClient extends BaseClient {
  async login(password: string): Promise<string> {
    const formData = new FormData()
    formData.set('password', password)

    const response = await this.publicRequest('/admin/login', { method: 'POST', body: formData })
    const data = (await response.json().catch(() => null)) as { token?: string; error?: string } | null

    if (!response.ok || !data?.token) {
      throw new ApiError(response.status, data?.error ?? `Fehler ${response.status}`)
    }

    return data.token
  }

  async logout(): Promise<void> {
    await this.authedRequest('/admin/logout', { method: 'POST' })
  }
}
