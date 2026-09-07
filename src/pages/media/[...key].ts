import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const prerender = false

// Serves media (podcast audio, offer/podcast cover images) directly from the STORAGE R2
// binding, same-origin, instead of relying on a separately-configured public CDN domain.
// This binding resolves to local on-disk state in dev and the real bucket in production
// automatically, so uploads work the same way in both environments. See docs/architecture.md.
//
// Astro's [...key] rest param arrives as a single, already slash-joined string (e.g. a
// request to /media/podcast/some-slug.mp3 gives params.key === 'podcast/some-slug.mp3'),
// which is exactly the R2 object key layout used by src/lib/admin-content.ts.

type ParsedRange = { offset: number; length?: number } | { suffix: number }

// Parses a `Range: bytes=start-end` request header (only the single-range forms browsers
// actually send for <audio>/<video> seeking: `bytes=start-end`, `bytes=start-`, and the
// suffix form `bytes=-length`). Anything else is ignored, falling back to a full response.
function parseRangeHeader(header: string | null): ParsedRange | undefined {
  if (!header) return undefined
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return undefined
  const [, startStr, endStr] = match
  if (startStr === '' && endStr === '') return undefined

  if (startStr === '') {
    const suffix = Number(endStr)
    return Number.isFinite(suffix) && suffix > 0 ? { suffix } : undefined
  }

  const offset = Number(startStr)
  if (!Number.isFinite(offset) || offset < 0) return undefined
  if (endStr === '') return { offset }

  const end = Number(endStr)
  if (!Number.isFinite(end) || end < offset) return undefined
  return { offset, length: end - offset + 1 }
}

function toR2Range(range: ParsedRange): R2Range {
  return 'suffix' in range ? { suffix: range.suffix } : { offset: range.offset, length: range.length }
}

export const GET: APIRoute = async ({ params, request }) => {
  const key = params.key
  if (!key) return new Response('Not found.', { status: 404 })

  const requestedRange = parseRangeHeader(request.headers.get('range'))

  let object: R2ObjectBody | null
  let servedRange = requestedRange
  try {
    object = await env.STORAGE.get(key, requestedRange ? { range: toR2Range(requestedRange) } : undefined)
  } catch {
    // Unsatisfiable or malformed range (e.g. an offset beyond the object's size) — fall back
    // to a full response rather than failing the request outright.
    servedRange = undefined
    object = await env.STORAGE.get(key)
  }
  if (!object) return new Response('Not found.', { status: 404 })

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=3600')
  headers.set('Accept-Ranges', 'bytes')

  if (servedRange) {
    // Resolve against object.size (always the full object size, regardless of range) rather
    // than trusting the shape R2 echoes back on object.range, so the same clamping logic
    // that governs which bytes R2 actually returns also governs the headers we report.
    const offset = 'suffix' in servedRange ? Math.max(object.size - servedRange.suffix, 0) : Math.min(servedRange.offset, object.size)
    const length =
      'suffix' in servedRange
        ? Math.min(servedRange.suffix, object.size)
        : Math.min(servedRange.length ?? object.size - offset, object.size - offset)
    const end = offset + length - 1
    headers.set('Content-Range', `bytes ${offset}-${end}/${object.size}`)
    headers.set('Content-Length', String(length))
    return new Response(object.body, { status: 206, headers })
  }

  headers.set('Content-Length', String(object.size))
  return new Response(object.body, { status: 200, headers })
}
