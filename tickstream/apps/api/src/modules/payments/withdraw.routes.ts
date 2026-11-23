import { env } from '@shared/env'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Creators move earnings out of Circle Gateway by signing a burn intent in their wallet. The browser sends the
 * signed intent here and this route forwards it to Gateway, which returns the attestation the wallet then mints.
 * The route only forwards intents whose depositor is the signed-in wallet; Gateway verifies the signature itself.
 */
export function registerWithdrawRoutes(router: Router): void {
  router.post('/creator/withdraw/relay', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    await rateLimit('withdraw', addr, 10, 60)
    const body = await readJson(ctx.req, 16 * 1024)
    const { burnIntent, signature } = body
    if (!isRecord(burnIntent) || !isRecord(burnIntent.spec) || typeof signature !== 'string') {
      throw new HttpError(400, 'Malformed withdrawal request', 'invalid_request')
    }
    const rawDepositor = burnIntent.spec.sourceDepositor
    const depositor = typeof rawDepositor === 'string' ? rawDepositor.toLowerCase() : ''
    if (!depositor.endsWith(addr.slice(2)) || depositor.length !== 66) {
      throw new HttpError(403, 'You can only withdraw your own balance', 'forbidden')
    }
    const response = await fetch(`${env.gatewayApiUrl()}/v1/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ burnIntent, signature }]),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => {
      throw new HttpError(502, 'Circle Gateway did not answer. Try again in a moment.', 'gateway_unreachable')
    })
    const result: unknown = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message = isRecord(result) && typeof result.message === 'string' ? result.message : 'Gateway rejected the withdrawal'
      throw new HttpError(502, message, 'gateway_rejected')
    }
    sendJson(ctx.res, 200, result)
  })
}
