import { SEGMENT_SECONDS } from '@shared/constants'
import { closeDb, migrate, query } from '@shared/db'
import { acquireLock, keys } from '@shared/redis'
import { getStorage, storageKeys } from '@shared/storage'
import type { SegmentInfo } from '@shared/types'
import { createEncryption } from './pipeline/encrypt'
import { ingest } from './pipeline/ingest'
import { readSegments } from './pipeline/package-hls'
import { probe } from './pipeline/probe'
import { transcodeToHls } from './pipeline/transcode'
import { publishSegments } from './pipeline/upload-r2'
import { validateProbe } from './pipeline/validate'

/**
 * Re-encodes finished videos whose segments are not SEGMENT_SECONDS long, from the original upload kept in storage.
 * The new segments get their own file names and key, and the video row is switched to them in one update, so a viewer
 * is never served half old and half new. The old segment files are removed after the switch.
 *
 *   bun run videos:reencode            re-encodes every video that needs it
 *   bun run videos:reencode --dry-run  only lists them
 */

interface Row {
  id: string
  title: string
  source_key: string | null
  segment_seconds: number
  segments: SegmentInfo[] | null
}

/** File name prefix for segments of this length, so they never collide with the files they replace. */
/** Unique per run, so new files never overwrite the files of an earlier encode that viewers may still be playing. */
const PREFIX = `r${Date.now().toString(36)}`
const CLAIM_TTL_MS = 90_000
const CLAIM_RENEW_MS = 30_000

async function reencode(row: Row): Promise<'done' | 'busy' | 'no-source'> {
  if (!row.source_key) return 'no-source'
  const claim = await acquireLock(keys.mediaJob(row.id), CLAIM_TTL_MS)
  if (!claim) return 'busy'
  const heartbeat = setInterval(() => void claim.renew().catch(() => undefined), CLAIM_RENEW_MS)
  const workspace = await ingest(row.id, row.source_key)
  try {
    const info = await probe(workspace.input)
    validateProbe(info)
    const encryption = await createEncryption(workspace.dir)
    const playlist = await transcodeToHls(workspace.input, workspace.hlsDir, encryption.keyInfoFile, info, PREFIX)
    const segments = await readSegments(playlist)
    await publishSegments(row.id, workspace.hlsDir, segments)
    const duration = segments.reduce((total, segment) => total + segment.duration, 0)
    await query(
      `update videos set duration_seconds = $2, segments = $3::jsonb, segment_seconds = $4, iv = $5, key_hex = $6, updated_at = now()
       where id = $1`,
      [row.id, duration, JSON.stringify(segments), SEGMENT_SECONDS, encryption.ivHex, encryption.keyHex],
    )
    // Only now are the old files unused.
    for (const old of row.segments ?? []) {
      await getStorage().remove(storageKeys.segment(row.id, old.name)).catch(() => undefined)
    }
    return 'done'
  } finally {
    clearInterval(heartbeat)
    await workspace.cleanup()
    await claim.release().catch(() => undefined)
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  await migrate()
  const rows = await query<Row>(
    `select id, title, source_key, segment_seconds, segments from videos
     where status = 'ready' and segment_seconds <> $1 order by created_at`,
    [SEGMENT_SECONDS],
  )
  console.log(`[reencode] ${rows.length} video(s) not at ${SEGMENT_SECONDS}-second segments${dryRun ? ' (dry run)' : ''}`)
  const tally = { done: 0, busy: 0, 'no-source': 0, failed: 0 }
  for (const row of rows) {
    if (dryRun) {
      console.log(`  ${row.id}  ${row.segment_seconds}s  ${row.source_key ? 'has original' : 'NO ORIGINAL, needs re-upload'}  ${row.title}`)
      continue
    }
    try {
      const result = await reencode(row)
      tally[result] += 1
      console.log(`[reencode] ${row.title}: ${result}`)
    } catch (error) {
      tally.failed += 1
      console.error(`[reencode] ${row.title}: failed`, error instanceof Error ? error.message : error)
    }
  }
  if (!dryRun) console.log('[reencode] finished', tally)
  await closeDb()
  // The queue connection would keep the process open, so end it here.
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('[reencode] failed', error)
  process.exit(1)
})
