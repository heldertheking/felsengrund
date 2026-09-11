import { BaseClient } from './BaseClient'
import type { ContactInput, CounselingInput, FeedbackInput, PrayerRequestInput, OkResponse } from '../Forms'

export class FormsClient extends BaseClient {
  submitContact(input: ContactInput): Promise<OkResponse> {
    return this.postJson('/contact', input)
  }

  submitCounseling(input: CounselingInput): Promise<OkResponse> {
    return this.postJson('/counseling', input)
  }

  submitFeedback(input: FeedbackInput): Promise<OkResponse> {
    return this.postJson('/feedback', input)
  }

  submitPrayerRequest(input: PrayerRequestInput): Promise<OkResponse> {
    return this.postJson('/prayer-request', input)
  }

  private postJson<T>(path: string, input: unknown): Promise<T> {
    return this.publicJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  }
}
