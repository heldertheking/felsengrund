import type { Env } from '../types';

const MEDIA_FIELDS = ['cardImage', 'coverImage', 'audioUrl'] as const;

/**
 * Rewrites relative `/media/<key>` references (as stored by admin-content.ts) into absolute
 * URLs pointing at this Worker, so the frontend - a different origin - can render them directly
 * with no origin-joining logic of its own. Mutates a shallow copy; safe to call on any object
 * that may or may not have these fields.
 */
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
