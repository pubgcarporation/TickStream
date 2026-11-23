import { query, queryOne } from '@shared/db'
import type { AdminOverview, PaymentRecord, VideoSummary } from '@shared/types'
import { HttpError, readJson, sendJson, type Router } from '../../http'
import { requireAdmin } from '../../middleware/authorization'
import { uuid } from '../../middleware/request-validation'
import { listVideos } from '../videos/videos.repository'

interface CountsRow {
  users: number
  videos: number
  removed: number
  sessions24h: number
  volume: number
  volume24h: number
}

interface PaymentRow {
  id: string
  video_id: string
  title: string
  payer: string
  amount_micro: number
  seconds: number
  status: PaymentRecord['status']
  transfer_id: string | null
  created_at: Date
  creator: string
}

interface UserRow {
  address: string
  username: string
  created_at: Date
  videos: number
  earned: number
}

export function registerAdminRoutes(router: Router): void {
  router.get('/admin/overview', 'required', async (ctx) => {
    requireAdmin(ctx)
    const row = await queryOne<CountsRow>(
      `select
         (select count(*)::int from users) as users,
         (select count(*)::int from videos where status <> 'removed') as videos,
         (select count(*)::int from videos where status = 'removed') as removed,
         (select count(*)::int from playback_sessions where started_at > now() - interval '24 hours') as "sessions24h",
         (select coalesce(sum(amount_micro), 0) from payments where status <> 'failed') as volume,
         (select coalesce(sum(amount_micro), 0) from payments where status <> 'failed' and created_at > now() - interval '24 hours') as volume24h`,
    )
    const overview: AdminOverview = {
      users: row?.users ?? 0,
      videos: row?.videos ?? 0,
      removedVideos: row?.removed ?? 0,
      sessions24h: row?.sessions24h ?? 0,
      volumeTotalMicro: row?.volume ?? 0,
      volume24hMicro: row?.volume24h ?? 0,
    }
    sendJson(ctx.res, 200, { overview })
  })

  router.get('/admin/videos', 'required', async (ctx) => {
    requireAdmin(ctx)
    const q = ctx.url.searchParams.get('q')?.trim().slice(0, 80) || undefined
    const videos: VideoSummary[] = await listVideos({ q, sort: 'new', limit: 60, offset: 0, includeRemoved: true })
    sendJson(ctx.res, 200, { videos })
  })

  router.post('/admin/videos/:id/status', 'required', async (ctx) => {
    requireAdmin(ctx)
    const body = await readJson(ctx.req, 4 * 1024)
    if (body.status !== 'removed' && body.status !== 'ready') throw new HttpError(400, 'Status must be removed or ready', 'invalid_request')
    const id = uuid(ctx.params.id ?? '')
    if (body.status === 'ready') {
      const playable = await queryOne('select 1 from videos where id = $1 and segments is not null', [id])
      if (!playable) throw new HttpError(409, 'This video was never encoded, so it cannot be restored', 'not_playable')
    }
    await query('update videos set status = $2, updated_at = now() where id = $1', [id, body.status])
    sendJson(ctx.res, 200, { ok: true })
  })

  router.get('/admin/payments', 'required', async (ctx) => {
    requireAdmin(ctx)
    const rows = await query<PaymentRow>(
      `select p.id, p.video_id, v.title, p.payer, p.amount_micro, p.seconds, p.status, p.transfer_id, p.created_at, p.creator
       from payments p join videos v on v.id = p.video_id order by p.created_at desc limit 100`,
    )
    const payments = rows.map((row) => ({
      id: row.id,
      videoId: row.video_id,
      videoTitle: row.title,
      payer: row.payer,
      creator: row.creator,
      amountMicro: row.amount_micro,
      seconds: row.seconds,
      status: row.status,
      transferId: row.transfer_id,
      createdAt: row.created_at.toISOString(),
    }))
    sendJson(ctx.res, 200, { payments })
  })

  router.get('/admin/users', 'required', async (ctx) => {
    requireAdmin(ctx)
    const rows = await query<UserRow>(
      `select u.address, u.username, u.created_at,
         (select count(*)::int from videos v where v.creator = u.address and v.status <> 'removed') as videos,
         (select coalesce(sum(p.amount_micro), 0) from payments p where p.creator = u.address and p.status <> 'failed') as earned
       from users u order by u.created_at desc limit 100`,
    )
    sendJson(ctx.res, 200, {
      users: rows.map((row) => ({
        address: row.address,
        username: row.username,
        createdAt: row.created_at.toISOString(),
        videos: row.videos,
        earnedMicro: row.earned,
      })),
    })
  })
}
