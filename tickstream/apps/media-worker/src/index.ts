import { migrate, query } from '@shared/db'
import { createBlockingRedis, getRedis, keys } from '@shared/redis'
import { mediaConcurrency } from './config/concurrency'
import { cleanupScratch } from './workers/cleanup.worker'
import { processVideo } from './workers/transcode.worker'

/** A video another copy is already encoding is retried after this long, in case that copy died mid-job. */
const BUSY_RETRY_MS = 30_000

async function requeueInterrupted(): Promise<void> {
  const rows = await query<{ id: string }>(`select id from videos where status = 'processing' and source_key is not null`)
  const redis = getRedis()
  let queued = 0
  for (const row of rows) {
    // Skip videos a live worker is encoding right now. A dead worker's claim expires on its own.
    if (await redis.exists(keys.mediaJob(row.id))) continue
    await redis.lpush(keys.mediaQueue, JSON.stringify({ videoId: row.id }))
    queued += 1
  }
  if (queued) console.log(`[media] re-queued ${queued} interrupted video(s)`)
}

/** One lane: takes jobs off the shared queue one at a time. Several lanes (and several workers) run side by side. */
async function consume(lane: number): Promise<never> {
  const blocking = createBlockingRedis()
  for (;;) {
    const item = await blocking.brpop(keys.mediaQueue, 0)
    const payload = item?.[1]
    if (!payload) continue
    try {
      const job = JSON.parse(payload) as { videoId?: string }
      if (!job.videoId) continue
      const result = await processVideo(job.videoId)
      if (result === 'busy') {
        const retry = payload
        setTimeout(() => void getRedis().lpush(keys.mediaQueue, retry).catch(() => undefined), BUSY_RETRY_MS).unref()
      }
    } catch (error) {
      console.error(`[media] lane ${lane} job error`, error)
    }
  }
}

async function main() {
  await migrate()
  await cleanupScratch()
  await requeueInterrupted()
  const lanes = mediaConcurrency()
  console.log(`[media] worker ready, ${lanes} video(s) at a time`)
  await Promise.all(Array.from({ length: lanes }, (_, lane) => consume(lane)))
}

main().catch((error: unknown) => {
  console.error('[media] worker crashed', error)
  process.exit(1)
})
