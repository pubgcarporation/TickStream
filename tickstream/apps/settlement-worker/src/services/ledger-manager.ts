import { query } from '@shared/db'

export interface PendingPayment {
  id: string
  transfer_id: string
}

/**
 * Pending payments in id order, starting after `afterId`. Paging by id (not by age) lets the worker walk the whole
 * queue, so payments that Gateway has not settled yet cannot crowd newer ones out of every check.
 */
export async function listPendingPayments(limit = 200, afterId?: string): Promise<PendingPayment[]> {
  return query<PendingPayment>(
    `select id, transfer_id from payments
     where status = 'pending' and transfer_id is not null and created_at < now() - interval '5 seconds'
       and ($2::uuid is null or id > $2::uuid)
     order by id asc limit $1`,
    [limit, afterId ?? null],
  )
}

export async function markSettled(id: string): Promise<void> {
  await query(`update payments set status = 'settled', settled_at = now() where id = $1 and status = 'pending'`, [id])
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await query(`update payments set status = 'failed', error = $2 where id = $1 and status = 'pending'`, [id, reason])
}
