import type { IncomingMessage, ServerResponse } from 'node:http'
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
import { registerWithdrawRoutes } from './modules/payments/withdraw.routes'
import { registerPlaybackRoutes } from './modules/playback/playback.routes'
import { registerReportRoutes } from './modules/reports/reports.routes'
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
registerEarningsRoutes(router)
registerWithdrawRoutes(router)
registerAnalyticsRoutes(router)
registerCommentRoutes(router)
registerSubscriptionRoutes(router)
registerReportRoutes(router)
registerAdminRoutes(router)

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
