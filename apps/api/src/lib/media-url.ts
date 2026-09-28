import type { Env } from '../types';

const MEDIA_FIELDS = ['cardImage', 'coverImage', 'audioUrl'] as const;

/** Rewrites relative /media/<key> refs into absolute Worker URLs the cross-origin frontend can render directly. */
export function rewriteMediaUrls<T extends object>(env: Env, data: T): T {
  const result: Record<string, unknown> = { ...data } as Record<string, unknown>;
  for (const field of MEDIA_FIELDS) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith('/media/')) {
      result[field] = `${env.KFA_WORKER_ORIGIN}${value}`;
    }
  }
  return result as T;
}
