export interface Env {
  STORAGE: R2Bucket
  N8N_WEBHOOK_URL: string
  N8N_WEBHOOK_SECRET?: string
  ADMIN_UPLOAD_PASSWORD?: string
  PUBLIC_WORKER_ORIGIN: string
  ALLOWED_ORIGINS: string
}
