import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { PAY_BLOCK_SECONDS } from '@shared/constants'
import { query } from '@shared/db'
import { segmentsAmount } from '@shared/pricing'
import { acquireLockWait, getRedis, keys } from '@shared/redis'
import { getStorage, storageKeys } from '@shared/storage'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { address, int, uuid } from '../../middleware/request-validation'
import { getVideoRow } from '../videos/videos.repository'
import { endSession, firstUnpaid, getManifest, paidKey, requireSession } from './playback.service'
import { loadSession, patchSession, saveSession, toSessionInfo, type LiveSession } from './session-store'

const MAX_CAP_MICRO = 100_000_000

function buildPlaylist(session: LiveSession, manifest: Awaited<ReturnType<typeof getManifest>>): string {
  const slice = manifest.segments.slice(session.startSeg, session.authEnd)
  const target = Math.ceil(Math.max(...manifest.segments.map((s) => s.duration), session.segSeconds))
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${target}`,
    `#EXT-X-MEDIA-SEQUENCE:${session.startSeg}`,
  ]
  const complete = session.authEnd >= session.segCount
  if (!complete) lines.push('#EXT-X-PLAYLIST-TYPE:EVENT')
  lines.push(`#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x${manifest.iv}`)
  slice.forEach((segment, index) => {
    lines.push(`#EXTINF:${segment.duration.toFixed(3)},`, `seg/${session.startSeg + index}`)
  })
  if (complete) lines.push('#EXT-X-ENDLIST')
  return `${lines.join('\n')}\n`
}

export function registerPlaybackRoutes(router: Router): void {
  router.post('/videos/:id/sessions', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('session-create', viewer, 20, 60)
    const body = await readJson(ctx.req)
    const payer = address(body.payer, 'payer')
    const capMicro = int(body.capMicro, 'capMicro', 1, MAX_CAP_MICRO)
    const video = await getVideoRow(uuid(ctx.params.id ?? ''))
    if (!video || video.status !== 'ready' || !video.segments) throw new HttpError(404, 'Video not found', 'not_found')

    const segCount = video.segments.length
    const segSeconds = video.segment_seconds
    const startSecond = body.startSecond === undefined ? 0 : int(body.startSecond, 'startSecond', 0, 10 * 24 * 3600)
    const startSeg = Math.min(Math.floor(startSecond / segSeconds), segCount - 1)
    // Playback starts with the first block paid and the next one paid right after, so the cap must cover both.
    if (capMicro < segmentsAmount(video.price_micro, Math.ceil((2 * PAY_BLOCK_SECONDS) / segSeconds), segSeconds)) {
      throw new HttpError(400, 'Your spending cap is lower than the first two payments', 'cap_too_low')
    }

    // One active session per wallet: a second tab or device ends the first.
    const redis = getRedis()
    const previousId = await redis.get(keys.viewerActive(viewer))
    if (previousId) {
      const previous = await loadSession(previousId, false)
      if (previous) await endSession(previous, 'replaced')
    }

    // The creator's free preview covers the first seconds of the video, for anyone who starts from the beginning.
    const previewSegs = startSeg === 0 ? Math.min(Math.ceil(video.preview_seconds / segSeconds), segCount) : 0

    const id = randomUUID()
    await query(
      `insert into playback_sessions (id, video_id, viewer, payer, cap_micro, chunk_seconds, segments_authorized, last_position)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, video.id, viewer, payer, capMicro, segSeconds, previewSegs, startSeg * segSeconds],
    )
    await query('update videos set views = views + 1 where id = $1', [video.id])

    const session: LiveSession = {
      id,
      videoId: video.id,
      viewer,
      payer,
      creator: video.creator,
      priceMicro: video.price_micro,
      // Every payment buys exactly one segment, so the payment interval is the segment length.
      chunkSeconds: segSeconds,
      capMicro,
      spentMicro: 0,
      startSeg,
      authEnd: startSeg + previewSegs,
      served: startSeg - 1,
      segCount,
      segSeconds,
      durationSeconds: video.duration_seconds ?? segCount * segSeconds,
      epoch: 1,
    }
    await saveSession(session)
    if (previewSegs > 0) {
      await redis.sadd(paidKey(id), ...Array.from({ length: previewSegs }, (_, index) => String(startSeg + index)))
      await redis.expire(paidKey(id), 6 * 3600)
    }
    await redis.set(keys.viewerActive(viewer), id, 'EX', 6 * 3600)
    sendJson(ctx.res, 201, { session: toSessionInfo(session) })
  })

  router.get('/sessions/:id', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const session = await requireSession(uuid(ctx.params.id ?? ''), viewer)
    if ((await getRedis().set(`play:seen:${session.id}`, '1', 'EX', 20, 'NX')) === 'OK') {
      await query('update playback_sessions set last_seen_at = now() where id = $1', [session.id])
    }
    sendJson(ctx.res, 200, { session: toSessionInfo(session) })
  })

  router.put('/sessions/:id/position', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('position', viewer, 30, 60)
    const session = await requireSession(uuid(ctx.params.id ?? ''), viewer)
    const body = await readJson(ctx.req, 1024)
    const second = int(body.second, 'second', 0, 10 * 24 * 3600)
    await query('update playback_sessions set last_position = $2, last_seen_at = now() where id = $1', [session.id, second])
    sendJson(ctx.res, 200, { session: toSessionInfo(session) })
  })

  router.get('/videos/:id/progress', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const rows = await query<{ last_position: number }>(
      `select last_position from playback_sessions where video_id = $1 and viewer = $2 and last_position > 0
       order by last_seen_at desc limit 1`,
      [uuid(ctx.params.id ?? ''), viewer],
    )
    sendJson(ctx.res, 200, { second: rows[0]?.last_position ?? 0 })
  })

  router.post('/sessions/:id/seek', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('seek', viewer, 60, 60)
    const id = uuid(ctx.params.id ?? '')
    const body = await readJson(ctx.req)
    const second = int(body.second, 'second', 0, 10 * 24 * 3600)
    // A payment in flight rewrites the session's paid window. Seeking waits for it, so the two can never overwrite
    // each other and leave the window pointing at the wrong place.
    const lock = await acquireLockWait(keys.grantLock(id), 20_000, 6_000)
    if (!lock) throw new HttpError(429, 'A payment is still going through. Try again in a moment.', 'busy')
    try {
      const session = await requireSession(id, viewer)
      const target = Math.min(Math.floor(second / session.segSeconds), session.segCount - 1)
      if (target >= session.startSeg && target < session.authEnd) {
        sendJson(ctx.res, 200, { session: toSessionInfo(session), reset: false })
        return
      }
      // Jumping outside what is unlocked starts a new playlist window. Skipped video is never billed,
      // and segments already paid for earlier in this session stay unlocked.
      const authEnd = await firstUnpaid(session.id, target, session.segCount)
      const next = { ...session, startSeg: target, authEnd, served: target - 1, epoch: session.epoch + 1 }
      await patchSession(session.id, { startSeg: next.startSeg, authEnd: next.authEnd, served: next.served, epoch: next.epoch })
      sendJson(ctx.res, 200, { session: toSessionInfo(next), reset: true })
    } finally {
      await lock.release().catch(() => undefined)
    }
  })

  router.delete('/sessions/:id', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const session = await loadSession(uuid(ctx.params.id ?? ''), false)
    if (session && session.viewer === viewer) {
      // The final position travels with the request, so closing a tab still saves where the viewer stopped.
      const body = await readJson(ctx.req, 1024).catch((): Record<string, unknown> => ({}))
      if (typeof body.second === 'number' && Number.isInteger(body.second) && body.second >= 0 && body.second < 10 * 24 * 3600) {
        await query('update playback_sessions set last_position = $2 where id = $1', [session.id, body.second])
      }
      await endSession(session, 'ended_by_viewer')
    }
    sendJson(ctx.res, 200, { ok: true })
  })

  router.get('/play/:id/playlist.m3u8', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const session = await requireSession(uuid(ctx.params.id ?? ''), viewer)
    if (session.authEnd <= session.startSeg) {
      throw new HttpError(402, 'Payment required before playback', 'payment_required')
    }
    const manifest = await getManifest(session.videoId)
    const body = buildPlaylist(session, manifest)
    ctx.res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
    })
    ctx.res.end(body)
  })

  router.get('/play/:id/key', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const session = await requireSession(uuid(ctx.params.id ?? ''), viewer)
    if (session.authEnd <= session.startSeg) throw new HttpError(402, 'Payment required', 'payment_required')
    const manifest = await getManifest(session.videoId)
    const key = Buffer.from(manifest.keyHex, 'hex')
    ctx.res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': key.length,
      'Cache-Control': 'no-store',
    })
    ctx.res.end(key)
  })

  router.get('/play/:id/seg/:n', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const session = await requireSession(uuid(ctx.params.id ?? ''), viewer)
    const n = Number(ctx.params.n)
    if (!Number.isInteger(n) || n < 0 || n >= session.segCount) throw new HttpError(404, 'No such segment', 'not_found')
    // Server-authorized delivery: only paid segments inside the current window. Nothing unpaid is ever served, so
    // how far ahead a viewer can fetch is exactly how far ahead they have paid.
    if (n < session.startSeg || n >= session.authEnd) {
      throw new HttpError(402, 'That segment has not been paid for', 'payment_required')
    }
    const manifest = await getManifest(session.videoId)
    const segment = manifest.segments[n]
    if (!segment) throw new HttpError(404, 'No such segment', 'not_found')
    if (n > session.served) await patchSession(session.id, { served: n })
    const object = await getStorage().getObject(storageKeys.segment(session.videoId, segment.name))
    ctx.res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Content-Length': object.size,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    })
    await pipeline(object.stream, ctx.res).catch(() => undefined)
  })
}
