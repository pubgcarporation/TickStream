import { migrate, query } from '@shared/db'
import { createBlockingRedis, getRedis, keys } from '@shared/redis'
import { cleanupScratch } from './workers/cleanup.worker'
import { processVideo } from './workers/transcode.worker'

async function requeueInterrupted(): Promise<void> {
  const rows = await query<{ id: string }>(`select id from videos where status = 'processing' and source_key is not null`)
  for (const row of rows) await getRedis().lpush(keys.mediaQueue, JSON.stringify({ videoId: row.id }))
  if (rows.length) console.log(`[media] re-queued ${rows.length} interrupted video(s)`)
}

async function main() {
  await migrate()
  await cleanupScratch()
  await requeueInterrupted()
  const blocking = createBlockingRedis()
  console.log('[media] worker ready')
  for (;;) {
    const item = await blocking.brpop(keys.mediaQueue, 0)
    const payload = item?.[1]
    if (!payload) continue
    try {
      const job = JSON.parse(payload) as { videoId?: string }
      if (job.videoId) await processVideo(job.videoId)
    } catch (error) {
      console.error('[media] job error', error)
    }
  }
}

main().catch((error: unknown) => {
  console.error('[media] worker crashed', error)
  process.exit(1)
})
