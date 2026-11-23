import { SESSION_IDLE_SECONDS } from '@shared/constants'
import { query } from '@shared/db'
import { getRedis, keys } from '@shared/redis'

/** Closes sessions whose viewer went away (no activity past the idle window) so they stop counting as active. */
export async function expireIdleSessions(): Promise<number> {
  const idle = await query<{ id: string; viewer: string }>(
    `select id, viewer from playback_sessions
     where status = 'active' and last_seen_at < now() - ($1 || ' seconds')::interval`,
    [String(SESSION_IDLE_SECONDS * 2)],
  )
  const redis = getRedis()
  for (const session of idle) {
    const live = await redis.exists(keys.session(session.id))
    if (live) continue
    await query(
      `update playback_sessions set status = 'ended', ended_at = now(), end_reason = 'idle' where id = $1 and status = 'active'`,
      [session.id],
    )
  }
  return idle.length
}
