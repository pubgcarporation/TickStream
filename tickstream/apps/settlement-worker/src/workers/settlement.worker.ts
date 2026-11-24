import { SESSION_IDLE_SECONDS } from '@shared/constants'
import { query } from '@shared/db'
import { getRedis, keys } from '@shared/redis'
import { runPool } from '../services/pool'

/** Closes sessions whose viewer went away (no activity past the idle window) so they stop counting as active. */
export async function expireIdleSessions(): Promise<number> {
  const idle = await query<{ id: string; viewer: string }>(
    `select id, viewer from playback_sessions
     where status = 'active' and last_seen_at < now() - ($1 || ' seconds')::interval`,
    [String(SESSION_IDLE_SECONDS * 2)],
  )
  const redis = getRedis()
  await runPool(idle, 16, async (session) => {
    const live = await redis.exists(keys.session(session.id))
    if (live) return
    await query(
      `update playback_sessions set status = 'ended', ended_at = now(), end_reason = 'idle' where id = $1 and status = 'active'`,
      [session.id],
    )
  })
  return idle.length
}

/** Uploads that never finished (the creator closed the tab) are taken down after a day. */
export async function purgeStaleUploads(): Promise<number> {
  const rows = await query<{ id: string }>(
    `update videos set status = 'removed', error = 'upload did not finish', updated_at = now()
     where status = 'uploading' and created_at < now() - interval '1 day' returning id`,
  )
  return rows.length
}
