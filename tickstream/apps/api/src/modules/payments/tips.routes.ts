import { MAX_TIP_MESSAGE_LENGTH, MAX_TIP_MICRO, MIN_TIP_MICRO } from '@shared/constants'
import { query } from '@shared/db'
import { getRedis } from '@shared/redis'
import { getArcNetwork } from '../../../../../packages/arc-sdk/src/client'
import {
  buildPaymentRequired,
  buildRequirements,
  checkAuthorization,
  encodeBase64Json,
  parsePaymentHeader,
  settlePayment,
} from '../../../../../packages/payment-sdk/src/x402-server'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { address, int, optionalStr, uuid } from '../../middleware/request-validation'
import { getVideoRow } from '../videos/videos.repository'

/**
 * Tips over x402, the same way viewing is paid: the first request gets a 402 with the exact amount and the creator
 * as recipient, then the viewer's spending wallet signs that exact amount and sends it back. Gateway must accept it
 * before the tip counts. A tip is stored as a payment with no session.
 */
export function registerTipRoutes(router: Router): void {
  router.post('/videos/:id/tip', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('tip', viewer, 20, 60)
    const body = await readJson<{ payer?: unknown; amountMicro?: unknown; message?: unknown; payment?: unknown }>(ctx.req, 32 * 1024)
    const payer = address(body.payer, 'payer')
    const amountMicro = int(body.amountMicro, 'amountMicro', MIN_TIP_MICRO, MAX_TIP_MICRO)
    const message = optionalStr(body.message, 'message', MAX_TIP_MESSAGE_LENGTH)

    const videoId = uuid(ctx.params.id ?? '')
    const video = await getVideoRow(videoId)
    if (!video || video.status !== 'ready') throw new HttpError(404, 'Video not found', 'not_found')
    if (video.creator.toLowerCase() === viewer.toLowerCase()) throw new HttpError(400, 'You cannot tip your own video', 'self_tip')

    // One tip at a time per viewer, so a double click can never send two.
    const redis = getRedis()
    const lockKey = `tip:lock:${viewer}`
    const locked = await redis.set(lockKey, '1', 'PX', 20_000, 'NX')
    if (locked !== 'OK') throw new HttpError(429, 'A tip is already in progress', 'busy')
    try {
      const requirements = buildRequirements(amountMicro, video.creator)
      const header =
        (typeof ctx.req.headers['payment-signature'] === 'string' ? ctx.req.headers['payment-signature'] : undefined) ??
        (typeof body.payment === 'string' ? body.payment : undefined)

      if (!header) {
        const paymentRequired = buildPaymentRequired(requirements, `/videos/${videoId}/tip`, 'Tip')
        sendJson(
          ctx.res,
          402,
          { error: 'Payment required', code: 'payment_required', amountMicro, paymentRequired },
          { 'PAYMENT-REQUIRED': encodeBase64Json(paymentRequired) },
        )
        return
      }

      const parsed = parsePaymentHeader(header)
      if (!parsed) throw new HttpError(400, 'Malformed payment', 'invalid_payment')
      const check = checkAuthorization(parsed.authorization, { payer, payTo: video.creator, amountMicro })
      if (!check.ok) throw new HttpError(402, 'The signed payment does not match this tip', check.reason)

      const arc = getArcNetwork()
      // The unique nonce is the replay guard: the same signed authorization can never count twice.
      const inserted = await query<{ id: string }>(
        `insert into payments (session_id, video_id, creator, payer, amount_micro, seconds, network, nonce, kind, message)
         values (null, $1, $2, $3, $4, 0, $5, $6, 'tip', $7)
         on conflict (nonce) do nothing returning id`,
        [video.id, video.creator, payer, amountMicro, arc.caip2, parsed.authorization.nonce.toLowerCase(), message ?? null],
      )
      const paymentId = inserted[0]?.id
      if (!paymentId) throw new HttpError(409, 'This payment was already used', 'replayed_payment')

      let outcome
      try {
        outcome = await settlePayment(parsed.payload, requirements)
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'settlement error'
        await query(`update payments set status = 'failed', error = $2 where id = $1`, [paymentId, reason.slice(0, 300)])
        throw new HttpError(502, 'Could not reach the payment network. Try again.', 'settlement_unavailable')
      }
      if (!outcome.success) {
        await query(`update payments set status = 'failed', error = $2 where id = $1`, [paymentId, outcome.errorReason ?? 'rejected'])
        throw new HttpError(402, 'The payment was not accepted', outcome.errorReason ?? 'payment_rejected')
      }
      await query('update payments set transfer_id = $2 where id = $1', [paymentId, outcome.transaction])

      sendJson(ctx.res, 200, { amountMicro, transferId: outcome.transaction, network: arc.caip2 })
    } finally {
      await redis.del(lockKey)
    }
  })
}
