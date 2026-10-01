import type { Env } from '../../types';

const MEDIA_FIELDS = ['cardImage', 'coverImage', 'audioUrl'] as const;

type ParsedRange = { offset: number; length?: number } | { suffix: number };

/** Parses an HTTP Range header (RFC 7233: `bytes=200-499`, `bytes=500-`, `bytes=-500`). Undefined if missing/malformed. */
const parseRangeHeader = (header: string | null): ParsedRange | undefined => {
  if (!header) return undefined;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return undefined;
  const [, startStr, endStr] = match;
  if (startStr === '' && endStr === '') return undefined;

  if (startStr === '') {
    const suffix = Number(endStr);
    return Number.isFinite(suffix) && suffix > 0 ? { suffix } : undefined;
  }

  const offset = Number(startStr);
  if (!Number.isFinite(offset) || offset < 0) return undefined;
  if (endStr === '') return { offset };

  const end = Number(endStr);
  if (!Number.isFinite(end) || end < offset) return undefined;
  return { offset, length: end - offset + 1 };
};

const toR2Range = (range: ParsedRange): R2Range => {
  return 'suffix' in range ? { suffix: range.suffix } : { offset: range.offset, length: range.length };
};

function rewriteMediaUrls<T extends object>(env: Env, data: T): T {
  const result: Record<string, unknown> = { ...data } as Record<string, unknown>;
  for (const field of MEDIA_FIELDS) {
    const value = result[field];
    if (typeof value === 'string' && value.startsWith('/media/')) {
      result[field] = `${env.KFA_WORKER_ORIGIN}${value}`;
    }
  }
  return result as T;
}

export { parseRangeHeader, toR2Range, rewriteMediaUrls };
export type { ParsedRange };
