import { query } from '@shared/db'

export interface PendingPayment {
  id: string
  transfer_id: string
}

export async function listPendingPayments(limit = 50): Promise<PendingPayment[]> {
  return query<PendingPayment>(
    `select id, transfer_id from payments
     where status = 'pending' and transfer_id is not null and created_at < now() - interval '5 seconds'
     order by created_at asc limit $1`,
    [limit],
  )
}

export async function markSettled(id: string): Promise<void> {
  await query(`update payments set status = 'settled', settled_at = now() where id = $1 and status = 'pending'`, [id])
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await query(`update payments set status = 'failed', error = $2 where id = $1 and status = 'pending'`, [id, reason])
}
