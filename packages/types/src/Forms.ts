export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface CounselingInput {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
  preferredContactMethod?: string;
  preferredCounselorGender?: string;
}

export interface FeedbackInput {
  message: string;
  name?: string;
  email?: string;
}

export interface PrayerRequestInput {
  topic: string;
  description: string;
  displayName?: string;
  email?: string;
}

export interface OkResponse {
  ok: true;
}

export interface ErrorResponse {
  error: string;
}
