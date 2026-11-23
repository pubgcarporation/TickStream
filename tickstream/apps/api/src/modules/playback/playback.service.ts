import { query } from '@shared/db'
import { getRedis } from '@shared/redis'
import type { SegmentInfo } from '@shared/types'
import { HttpError } from '../../http'
import { getVideoRow, type VideoRow } from '../videos/videos.repository'
import { dropSession, loadSession, type LiveSession } from './session-store'

export const endedKey = (id: string) => `play:ended:${id}`
export const paidKey = (id: string) => `play:paid:${id}`

interface Manifest {
  segments: SegmentInfo[]
  iv: string
  keyHex: string
  loadedAt: number
}

const manifests = new Map<string, Manifest>()

export async function getManifest(videoId: string): Promise<Manifest> {
  const cached = manifests.get(videoId)
  if (cached && Date.now() - cached.loadedAt < 60_000) return cached
  const row: VideoRow | undefined = await getVideoRow(videoId)
  if (!row || row.status !== 'ready' || !row.segments || !row.iv || !row.key_hex) {
    throw new HttpError(404, 'Video not found', 'not_found')
  }
  const manifest = { segments: row.segments, iv: row.iv, keyHex: row.key_hex, loadedAt: Date.now() }
  manifests.set(videoId, manifest)
  return manifest
}

/** Loads a session and proves the caller owns it. Explains why when the session is gone. */
export async function requireSession(id: string, viewer: string, touch = true): Promise<LiveSession> {
  const session = await loadSession(id, touch)
  if (!session) {
    const reason = await getRedis().get(endedKey(id))
    throw new HttpError(410, 'This viewing session has ended', 'session_ended', { reason: reason ?? 'expired' })
  }
  if (session.viewer !== viewer) throw new HttpError(403, 'This session belongs to another wallet', 'forbidden')
  return session
}

export async function endSession(session: LiveSession, reason: string): Promise<void> {
  await query(
    `update playback_sessions set status = 'ended', ended_at = now(), end_reason = $2,
       spent_micro = $3, segments_authorized = $4, last_seen_at = now()
     where id = $1 and status = 'active'`,
    [session.id, reason, session.spentMicro, Math.max(0, session.authEnd - session.startSeg)],
  )
  const redis = getRedis()
  await redis.set(endedKey(session.id), reason, 'EX', 300)
  await redis.del(paidKey(session.id))
  await dropSession(session)
}

/** First segment at or after `from` that has not been paid for in this session. */
export async function firstUnpaid(sessionId: string, from: number, segCount: number): Promise<number> {
  const paid = new Set((await getRedis().smembers(paidKey(sessionId))).map(Number))
  let next = from
  while (next < segCount && paid.has(next)) next += 1
  return next
}
