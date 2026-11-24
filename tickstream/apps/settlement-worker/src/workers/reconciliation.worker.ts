import { getRedis, keys } from '@shared/redis'
import { runPool } from '../services/pool'
import { GatewayBusyError, fetchTransferStatus } from '../services/payment-verifier'
import { listPendingPayments, markFailed, markSettled, type PendingPayment } from '../services/ledger-manager'

function intFromEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value > 0 ? Math.min(max, Math.max(min, Math.floor(value))) : fallback
}

/**
 * Gateway status lookups run in parallel, because each takes a few hundred ms from far away. The worker starts at
 * RECONCILE_CONCURRENCY and speeds up (doubling per page) while Gateway keeps answering, up to
 * RECONCILE_MAX_CONCURRENCY. When Gateway says "too many requests" it halves and resumes next cycle.
 */
const START_CONCURRENCY = intFromEnv('RECONCILE_CONCURRENCY', 16, 1, 512)
const MAX_CONCURRENCY = Math.max(START_CONCURRENCY, intFromEnv('RECONCILE_MAX_CONCURRENCY', 128, 1, 512))
const MIN_CONCURRENCY = 2
let concurrency = START_CONCURRENCY
/** Doubling is for finding the limit once. After Gateway has pushed back, it only creeps up. */
let probing = true
/** True when the last cycle stopped early with payments still unchecked, so the next one should start right away. */
let backlogRemains = false

export function reconcileBacklogRemains(): boolean {
  return backlogRemains
}
/** One cycle stops starting new pages after this long, so a big backlog never blocks the other jobs. */
const BUDGET_MS = intFromEnv('RECONCILE_BUDGET_MS', 8_000, 1_000, 60_000)
const MIN_PAGE_SIZE = 200
/**
 * Several copies of this worker may run at once. A payment is claimed for a few seconds before it is checked, so two
 * copies never look up the same one at the same time. The claim also spaces out re-checks of unsettled payments.
 */
const CLAIM_MS = 4_000

/** Where the last cycle stopped. The next one continues from here, so every pending payment gets its turn. */
let cursor: string | undefined

/** Matches each accepted nanopayment to its Gateway transfer and records when it settles. */
export async function reconcilePayments(): Promise<number> {
  const startedAt = Date.now()
  let updated = 0
  let throttled = false

  const check = async (payment: PendingPayment): Promise<void> => {
    const claimed = await getRedis().set(keys.reconcileClaim(payment.id), '1', 'PX', CLAIM_MS, 'NX')
    if (claimed !== 'OK') return
    try {
      const status = await fetchTransferStatus(payment.transfer_id).catch((error: unknown) => {
        if (error instanceof GatewayBusyError) throw error
        return 'unknown' as const
      })
      if (status === 'completed' || status === 'confirmed') {
        await markSettled(payment.id)
        updated += 1
      } else if (status === 'failed') {
        await markFailed(payment.id, 'transfer failed at gateway')
        updated += 1
      }
    } catch (error) {
      if (error instanceof GatewayBusyError) throttled = true
      else throw error
    }
  }

  backlogRemains = false
  while (!throttled && Date.now() - startedAt < BUDGET_MS) {
    const page = await listPendingPayments(Math.max(MIN_PAGE_SIZE, concurrency * 4), cursor)
    if (page.length === 0) {
      cursor = undefined // reached the end of the queue: start over next cycle
      break
    }
    const started = await runPool(page, concurrency, check, () => throttled || Date.now() - startedAt >= BUDGET_MS)
    // Resume right after the last payment that was actually checked, never past one that was skipped.
    cursor = started > 0 ? page[started - 1]?.id : cursor
    if (!throttled && started === page.length) {
      const grown = probing ? concurrency * 2 : concurrency + Math.max(2, Math.floor(concurrency / 10))
      concurrency = Math.min(MAX_CONCURRENCY, grown)
    }
    if (started < page.length) backlogRemains = true
  }
  if (throttled) {
    probing = false
    concurrency = Math.max(MIN_CONCURRENCY, Math.floor(concurrency / 2))
    console.warn(`[settlement] reconcile: Gateway asked to slow down, now ${concurrency} at a time`)
  }
  return updated
}
