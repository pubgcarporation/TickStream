import { migrate } from '@shared/db'
import { acquireLock, keys } from '@shared/redis'
import { expireIdleSessions, purgeStaleUploads } from './workers/settlement.worker'
import { reconcilePayments, reconcileBacklogRemains } from './workers/reconciliation.worker'

const RECONCILE_EVERY_MS = Math.max(1_000, Number(process.env.RECONCILE_EVERY_MS) || 5_000)
const EXPIRE_EVERY_MS = 30_000
const PURGE_EVERY_MS = 60 * 60 * 1000

const running = new Set<string>()

/**
 * Runs a job without overlapping itself. With `onlyOne`, only one copy of the worker runs it at a time: the copy that
 * takes the lock does the work and the rest skip that tick. Status checks do not need this because they claim each
 * payment on its own, so every copy helps with them.
 */
async function safely(name: string, job: () => Promise<number>, onlyOne?: { lockMs: number }): Promise<void> {
  // A slow run must not overlap the next tick.
  if (running.has(name)) return
  running.add(name)
  const lock = onlyOne ? await acquireLock(keys.lock(`settlement:${name}`), onlyOne.lockMs).catch(() => undefined) : undefined
  try {
    if (onlyOne && !lock) return
    const touched = await job()
    if (touched > 0) console.log(`[settlement] ${name}: ${touched} updated`)
  } catch (error) {
    console.error(`[settlement] ${name} failed`, error)
  } finally {
    await lock?.release().catch(() => undefined)
    running.delete(name)
  }
}

async function main() {
  await migrate()
  console.log('[settlement] worker ready')
  // Status checks run back to back while a backlog remains, and otherwise every few seconds.
  void (async () => {
    for (;;) {
      await safely('reconcile', reconcilePayments)
      await new Promise((resolve) => setTimeout(resolve, reconcileBacklogRemains() ? 250 : RECONCILE_EVERY_MS))
    }
  })()
  setInterval(() => void safely('expire', expireIdleSessions, { lockMs: EXPIRE_EVERY_MS - 2_000 }), EXPIRE_EVERY_MS)
  setInterval(() => void safely('purge uploads', purgeStaleUploads, { lockMs: 5 * 60_000 }), PURGE_EVERY_MS)
}

main().catch((error: unknown) => {
  console.error('[settlement] worker crashed', error)
  process.exit(1)
})
