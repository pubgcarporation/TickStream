import { fetchTransferStatus } from '../services/payment-verifier'
import { listPendingPayments, markFailed, markSettled } from '../services/ledger-manager'

/** Matches each accepted nanopayment to its Gateway transfer and records when it settles. */
export async function reconcilePayments(): Promise<number> {
  const pending = await listPendingPayments()
  let updated = 0
  for (const payment of pending) {
    const status = await fetchTransferStatus(payment.transfer_id).catch(() => 'unknown' as const)
    if (status === 'completed' || status === 'confirmed') {
      await markSettled(payment.id)
      updated += 1
    } else if (status === 'failed') {
      await markFailed(payment.id, 'transfer failed at gateway')
      updated += 1
    }
  }
  return updated
}
