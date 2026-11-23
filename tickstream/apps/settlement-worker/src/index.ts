import { migrate } from '@shared/db'
import { expireIdleSessions } from './workers/settlement.worker'
import { reconcilePayments } from './workers/reconciliation.worker'

const RECONCILE_EVERY_MS = 10_000
const EXPIRE_EVERY_MS = 30_000

async function safely(name: string, job: () => Promise<number>): Promise<void> {
  try {
    const touched = await job()
    if (touched > 0) console.log(`[settlement] ${name}: ${touched} updated`)
  } catch (error) {
    console.error(`[settlement] ${name} failed`, error)
  }
}

async function main() {
  await migrate()
  console.log('[settlement] worker ready')
  setInterval(() => void safely('reconcile', reconcilePayments), RECONCILE_EVERY_MS)
  setInterval(() => void safely('expire', expireIdleSessions), EXPIRE_EVERY_MS)
}

main().catch((error: unknown) => {
  console.error('[settlement] worker crashed', error)
  process.exit(1)
})
