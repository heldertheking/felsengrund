export interface Env {
  ENVIRONMENT: 'local' | 'production' | 'development';
  KFA_WORKER_ORIGIN: string;
  KFA_WEBPAGE_ORIGIN: string;
  KFA_ALLOWED_ORIGINS: string;
  KFA_NOTIFICATION_WEBHOOK: string;
  KFA_ADMIN_PASSWORD?: string;
  STORAGE: R2Bucket;
}
