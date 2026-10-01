export interface Env {
  ENVIRONMENT: 'local' | 'production' | 'development';
  KFA_WORKER_ORIGIN: string;
  KFA_WEBPAGE_ORIGIN: string;
  KFA_ALLOWED_ORIGINS: string;
  KFA_ADMIN_PASSWORD?: string;
  KFA_MAIL_PASSWORD?: string;
  /** Test inbox that receives all notification mail outside production. */
  KFA_DEV_NOTIFICATION_RECIPIENT?: string;
  KFA_SESSION_TTL_MS?: string;
  STORAGE: R2Bucket;
}

/** Shape of every error body the API returns; the shared client in `@felsengrund/types` reads `message`. */
export interface ApiError {
  status: 'error' | 'fail';
  message: string;
  meta?: Record<string, unknown>;
}

export const createApiError = (message: string, meta?: Record<string, unknown>): ApiError => ({
  status: 'error',
  message,
  ...(meta && { meta }),
});

export interface FormError {
  status: 'error' | 'fail';
  type: 'sending' | 'validation' | 'unknown';
  message: string;
  validationErrors?: Record<string, unknown>; // Used strictly for validation errors (e.g. field 1 should be between 1 and 100
  meta?: Record<string, unknown>;
}

export const createFormError = (
  type: 'sending' | 'validation' | 'unknown',
  message: string,
  validationErrors?: Record<string, unknown>,
  meta?: Record<string, unknown>,
): FormError => ({
  status: type == 'sending' ? 'fail' : 'error',
  type: type,
  message,
  validationErrors,
  ...(meta && { meta }),
});
