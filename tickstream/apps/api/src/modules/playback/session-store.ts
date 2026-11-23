import { SESSION_IDLE_SECONDS } from '@shared/constants'
import { getRedis, keys } from '@shared/redis'
import type { SessionInfo } from '@shared/types'

/** Live playback state. Redis is the authority for what a viewer has paid for; the browser never decides. */
export interface LiveSession {
  id: string
  videoId: string
  viewer: string
  payer: string
  creator: string
  priceMicro: number
  chunkSeconds: number
  capMicro: number
  spentMicro: number
  /** First segment of the current playlist (changes when the viewer jumps ahead). */
  startSeg: number
  /** Exclusive end of the authorized (paid) segments. */
  authEnd: number
  /** Highest segment already delivered. */
  served: number
  segCount: number
  segSeconds: number
  durationSeconds: number
  epoch: number
}

const NUMERIC: Array<keyof LiveSession> = [
  'priceMicro',
  'chunkSeconds',
  'capMicro',
  'spentMicro',
  'startSeg',
  'authEnd',
  'served',
  'segCount',
  'segSeconds',
  'durationSeconds',
  'epoch',
]

export async function saveSession(session: LiveSession): Promise<void> {
  const redis = getRedis()
  const key = keys.session(session.id)
  const flat: Record<string, string> = {}
  for (const [field, value] of Object.entries(session)) flat[field] = String(value)
  await redis.hset(key, flat)
  await redis.expire(key, SESSION_IDLE_SECONDS)
}

export async function loadSession(id: string, touch = true): Promise<LiveSession | undefined> {
  const redis = getRedis()
  const key = keys.session(id)
  const raw = await redis.hgetall(key)
  if (!raw.id) return undefined
  if (touch) await redis.expire(key, SESSION_IDLE_SECONDS)
  const parsed: Record<string, string | number> = { ...raw }
  for (const field of NUMERIC) parsed[field] = Number(raw[field] ?? 0)
  return parsed as unknown as LiveSession
}

export async function patchSession(id: string, fields: Partial<Record<keyof LiveSession, string | number>>): Promise<void> {
  const flat: Record<string, string> = {}
  for (const [field, value] of Object.entries(fields)) flat[field] = String(value)
  await getRedis().hset(keys.session(id), flat)
}

export async function dropSession(session: LiveSession): Promise<void> {
  const redis = getRedis()
  await redis.del(keys.session(session.id))
  const active = await redis.get(keys.viewerActive(session.viewer))
  if (active === session.id) await redis.del(keys.viewerActive(session.viewer))
}

export function toSessionInfo(session: LiveSession): SessionInfo {
  const seg = session.segSeconds
  const authorizedEndSecond = Math.min(session.authEnd * seg, session.durationSeconds)
  const startSecond = session.startSeg * seg
  return {
    id: session.id,
    videoId: session.videoId,
    chunkSeconds: session.chunkSeconds,
    capMicro: session.capMicro,
    spentMicro: session.spentMicro,
    authorizedSeconds: Math.max(0, authorizedEndSecond - startSecond),
    startSecond,
    authorizedEndSecond,
    durationSeconds: session.durationSeconds,
    segmentSeconds: seg,
    priceMicro: session.priceMicro,
    complete: session.authEnd >= session.segCount,
    // Relative to the API base so the same value works behind any proxy prefix.
    playlistUrl: `play/${session.id}/playlist.m3u8?e=${session.epoch}`,
  }
}
