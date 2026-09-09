import { Hono } from 'hono'
import type { Env } from '../types'

export const mediaRoute = new Hono<{ Bindings: Env }>()

// Serves media (podcast audio, offer/podcast cover images) directly from the STORAGE R2
// binding. This binding resolves to local on-disk state in dev and the real bucket in
// production automatically, so uploads work the same way in both environments.
//
// The key is read off `c.req.path` rather than `c.req.param('*')`: on the installed Hono
// version (4.13.7), the trie router never assigns a value for a bare unnamed `*` segment — the
// wildcard route matches, but `c.req.param('*')` is always `undefined` — so every /media/*
// request was 404ing regardless of whether the object existed in R2. Slicing the prefix off the
// path is what actually works, and needs no dependency on that router-specific behavior.

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

mediaRoute.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '')
  if (!key) {
    console.warn('[media] request with no key after /media/')
    return c.text('Not found.', 404)
  }

  const requestedRange = parseRangeHeader(c.req.header('range') ?? null)

  let object: R2ObjectBody | null
  let servedRange = requestedRange
  try {
    object = await c.env.STORAGE.get(key, requestedRange ? { range: toR2Range(requestedRange) } : undefined)
  } catch (error) {
    // Unsatisfiable or malformed range (e.g. an offset beyond the object's size) — fall back
    // to a full response rather than failing the request outright.
    console.warn(`[media] range request failed for key="${key}", falling back to full object`, error)
    servedRange = undefined
    object = await c.env.STORAGE.get(key)
  }
  if (!object) {
    // This is the exact signal for "upload succeeded but the file isn't actually in R2" (or a
    // key mismatch between what was stored and what's referenced) — always worth a log line,
    // since from the client it's indistinguishable from a routing problem.
    console.warn(`[media] key not found in R2: "${key}"`)
    return c.text('Not found.', 404)
  }

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
})
