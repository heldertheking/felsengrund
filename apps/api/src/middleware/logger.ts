import type { MiddlewareHandler } from 'hono'
import { createLogger } from '@felsengrund/logger'
import type { Env } from '../types'

const logger = createLogger('http')

// Logs every request/response with enough detail (method, path, origin, status, duration) to
// reconstruct what happened from Workers Logs after the fact — deliberately applied before
// corsMiddleware so even a request rejected for its Origin still shows up here.
export const requestLogger: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const start = Date.now()
  const { method } = c.req
  const path = c.req.path
  const origin = c.req.header('origin') ?? '-'

  logger.info('request', { method, path, origin })

  await next()

  const durationMs = Date.now() - start
  logger.info('response', { method, path, status: c.res.status, durationMs })
}
