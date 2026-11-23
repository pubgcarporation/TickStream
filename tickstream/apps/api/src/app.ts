import type { IncomingMessage, ServerResponse } from 'node:http'
import { clientIp, HttpError, Router, sendJson, type Ctx } from './http'
import { authenticate } from './middleware/authentication'
import { handleError } from './middleware/error-handler'
import { registerAuthRoutes } from './modules/auth/auth.routes'
import { registerEarningsRoutes } from './modules/earnings/earnings.routes'
import { registerGrantRoutes } from './modules/payments/grant.routes'
import { registerPlaybackRoutes } from './modules/playback/playback.routes'
import { registerUploadRoutes } from './modules/uploads/uploads.routes'
import { registerUserRoutes } from './modules/users/users.routes'
import { registerVideoRoutes } from './modules/videos/videos.routes'

const router = new Router()
router.get('/health', 'none', (ctx) => sendJson(ctx.res, 200, { ok: true }))
registerAuthRoutes(router)
registerUserRoutes(router)
registerVideoRoutes(router)
registerUploadRoutes(router)
registerPlaybackRoutes(router)
registerGrantRoutes(router)
registerEarningsRoutes(router)

export async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
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
