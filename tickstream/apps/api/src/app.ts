import type { IncomingMessage, ServerResponse } from 'node:http'
import { env } from '@shared/env'
import { getPool } from '@shared/db'
import { getRedis } from '@shared/redis'
import { clientIp, HttpError, Router, sendJson, type Ctx } from './http'
import { authenticate } from './middleware/authentication'
import { handleError } from './middleware/error-handler'
import { registerAdminRoutes } from './modules/admin/admin.routes'
import { registerAnalyticsRoutes } from './modules/analytics/analytics.routes'
import { registerAuthRoutes } from './modules/auth/auth.routes'
import { registerCommentRoutes } from './modules/comments/comments.routes'
import { registerEarningsRoutes } from './modules/earnings/earnings.routes'
import { registerGrantRoutes } from './modules/payments/grant.routes'
import { registerTipRoutes } from './modules/payments/tips.routes'
import { registerWithdrawRoutes } from './modules/payments/withdraw.routes'
import { registerPlaybackRoutes } from './modules/playback/playback.routes'
import { registerSubscriptionRoutes } from './modules/subscriptions/subscriptions.routes'
import { registerUploadRoutes } from './modules/uploads/uploads.routes'
import { registerUserRoutes } from './modules/users/users.routes'
import { registerVideoRoutes } from './modules/videos/videos.routes'

const router = new Router()
router.get('/health', 'none', (ctx) => sendJson(ctx.res, 200, { ok: true }))
router.get('/health/ready', 'none', async (ctx) => {
  const checks = { database: false, redis: false }
  try {
    await getPool().query('select 1')
    checks.database = true
  } catch {
    // reported below
  }
  try {
    checks.redis = (await getRedis().ping()) === 'PONG'
  } catch {
    // reported below
  }
  sendJson(ctx.res, checks.database && checks.redis ? 200 : 503, { ok: checks.database && checks.redis, ...checks })
})
registerAuthRoutes(router)
registerUserRoutes(router)
registerVideoRoutes(router)
registerUploadRoutes(router)
registerPlaybackRoutes(router)
registerGrantRoutes(router)
registerTipRoutes(router)
registerEarningsRoutes(router)
registerWithdrawRoutes(router)
registerAnalyticsRoutes(router)
registerCommentRoutes(router)
registerSubscriptionRoutes(router)
registerAdminRoutes(router)

const CORS_HEADERS = 'Authorization, Content-Type, PAYMENT-SIGNATURE'
const CORS_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'

/**
 * Lets the website call the API from another origin. Only origins listed in CORS_ORIGINS are allowed.
 * Returns true when the request was a preflight and is already answered.
 */
function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin
  if (!origin) return false
  if (!env.corsOrigins.includes(origin)) {
    // Not an allowed website: answer a preflight without CORS headers so the browser blocks the real request.
    if (req.method !== 'OPTIONS') return false
    res.writeHead(204).end()
    return true
  }
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE')
  if (req.method !== 'OPTIONS') return false
  res.setHeader('Access-Control-Allow-Methods', CORS_METHODS)
  res.setHeader('Access-Control-Allow-Headers', CORS_HEADERS)
  res.setHeader('Access-Control-Max-Age', '86400')
  res.writeHead(204).end()
  return true
}

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (applyCors(req, res)) return
  const startedAt = Date.now()
  res.on('finish', () => {
    const path = (req.url ?? '/').split('?')[0] ?? '/'
    // Segment and heartbeat traffic is high volume; log only failures for it.
    const noisy = path.startsWith('/play/') || path.startsWith('/health')
    if (!noisy || res.statusCode >= 400) {
      console.log(`[api] ${req.method} ${path} ${res.statusCode} ${Date.now() - startedAt}ms`)
    }
  })
  try {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    const url = new URL(req.url ?? '/', 'http://localhost')
    const matched = router.match(req.method ?? 'GET', url.pathname)
    if (!matched) throw new HttpError(404, 'Not found', 'not_found')
    const ctx: Ctx = { req, res, url, params: matched.params, ip: clientIp(req) }
    if (matched.route.auth !== 'none') {
      ctx.user = await authenticate(req)
      if (matched.route.auth === 'required' && !ctx.user) {
        throw new HttpError(401, 'Sign in with your wallet first', 'unauthorized')
      }
    }
    await matched.route.handler(ctx)
  } catch (error) {
    handleError(res, error)
  }
}
