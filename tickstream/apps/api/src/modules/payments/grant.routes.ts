import { query } from '@shared/db'
import { chunkSegments, segmentsAmount } from '@shared/pricing'
import { getRedis, keys } from '@shared/redis'
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
import { uuid } from '../../middleware/request-validation'
import { paidKey, requireSession } from '../playback/playback.service'
import { patchSession, toSessionInfo } from '../playback/session-store'

/**
 * Pay-per-chunk access over x402. One request, one chunk of whole segments:
 * no payment, a 402 with the exact price. A signed authorization for exactly that amount, from the
 * wallet registered for this session, to the creator, is settled by Gateway before any segment unlocks.
 */
export function registerGrantRoutes(router: Router): void {
  router.post('/sessions/:id/grant', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const id = uuid(ctx.params.id ?? '')
    await rateLimit('grant', id, 40, 60)
    const redis = getRedis()
    const locked = await redis.set(keys.grantLock(id), '1', 'PX', 20_000, 'NX')
    if (locked !== 'OK') throw new HttpError(429, 'A payment for this session is already in progress', 'busy')
    try {
      const session = await requireSession(id, viewer)
      if (session.authEnd >= session.segCount) {
        sendJson(ctx.res, 200, { session: toSessionInfo(session), amountMicro: 0, transferId: null, complete: true })
        return
      }
      const body = await readJson<{ payment?: unknown }>(ctx.req, 32 * 1024)

      const segments = Math.min(chunkSegments(session.chunkSeconds), session.segCount - session.authEnd)
      const seconds = segments * session.segSeconds
      const amountMicro = segmentsAmount(session.priceMicro, segments)
      if (session.spentMicro + amountMicro > session.capMicro) {
        throw new HttpError(409, 'Your spending cap for this session has been reached', 'cap_reached', {
          session: toSessionInfo(session),
        })
      }

      const requirements = buildRequirements(amountMicro, session.creator)
      const header =
        (typeof ctx.req.headers['payment-signature'] === 'string' ? ctx.req.headers['payment-signature'] : undefined) ??
        (typeof body.payment === 'string' ? body.payment : undefined)

      if (!header) {
        const paymentRequired = buildPaymentRequired(requirements, `/sessions/${id}/grant`, `${seconds}s of video`)
        sendJson(
          ctx.res,
          402,
          { error: 'Payment required', code: 'payment_required', amountMicro, seconds, paymentRequired },
          { 'PAYMENT-REQUIRED': encodeBase64Json(paymentRequired) },
        )
        return
      }

      const parsed = parsePaymentHeader(header)
      if (!parsed) throw new HttpError(400, 'Malformed payment', 'invalid_payment')
      const check = checkAuthorization(parsed.authorization, { payer: session.payer, payTo: session.creator, amountMicro })
      if (!check.ok) throw new HttpError(402, 'The signed payment does not match this request', check.reason)

      const arc = getArcNetwork()
      // The unique nonce is the replay guard: the same signed authorization can never unlock twice.
      const inserted = await query<{ id: string }>(
        `insert into payments (session_id, video_id, creator, payer, amount_micro, seconds, network, nonce)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (nonce) do nothing returning id`,
        [session.id, session.videoId, session.creator, session.payer, amountMicro, seconds, arc.caip2, parsed.authorization.nonce.toLowerCase()],
      )
      const paymentId = inserted[0]?.id
      if (!paymentId) throw new HttpError(409, 'This payment was already used', 'replayed_payment')

      let outcome
      try {
        outcome = await settlePayment(parsed.payload, requirements)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'settlement error'
        await query(`update payments set status = 'failed', error = $2 where id = $1`, [paymentId, message.slice(0, 300)])
        throw new HttpError(502, 'Could not reach the payment network. Try again.', 'settlement_unavailable')
      }
      if (!outcome.success) {
        await query(`update payments set status = 'failed', error = $2 where id = $1`, [paymentId, outcome.errorReason ?? 'rejected'])
        throw new HttpError(402, 'The payment was not accepted', outcome.errorReason ?? 'payment_rejected')
      }

      const first = session.authEnd
      const next = { ...session, authEnd: first + segments, spentMicro: session.spentMicro + amountMicro }
      const paid = Array.from({ length: segments }, (_, index) => String(first + index))
      // These writes do not depend on each other, so they run together instead of one after another.
      await Promise.all([
        redis.multi().sadd(paidKey(session.id), ...paid).expire(paidKey(session.id), 6 * 3600).exec(),
        patchSession(session.id, { authEnd: next.authEnd, spentMicro: next.spentMicro }),
        query('update payments set transfer_id = $2 where id = $1', [paymentId, outcome.transaction]),
        query(`update playback_sessions set spent_micro = $2, segments_authorized = $3, last_seen_at = now() where id = $1`, [
          session.id,
          next.spentMicro,
          next.authEnd - next.startSeg,
        ]),
      ])

      sendJson(
        ctx.res,
        200,
        { session: toSessionInfo(next), amountMicro, transferId: outcome.transaction, network: arc.caip2 },
        {
          'PAYMENT-RESPONSE': encodeBase64Json({
            success: true,
            transaction: outcome.transaction,
            network: arc.caip2,
            payer: session.payer,
          }),
        },
      )
    } finally {
      await redis.del(keys.grantLock(id))
    }
  })
}
