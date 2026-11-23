import { query, queryOne } from '@shared/db'
import type { AdminOverview, PaymentRecord, ReportItem, VideoStatus, VideoSummary } from '@shared/types'
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
  reports: number
}

interface ReportRow {
  id: string
  reason: string
  details: string
  status: 'open' | 'resolved'
  resolution: string | null
  created_at: Date
  reporter: string
  video_id: string | null
  video_title: string | null
  video_creator: string | null
  video_status: VideoStatus | null
  comment_id: string | null
  comment_body: string | null
  comment_author: string | null
  comment_video: string | null
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

function mapReport(row: ReportRow): ReportItem {
  const target: ReportItem['target'] = row.video_id
    ? {
        kind: 'video',
        id: row.video_id,
        title: row.video_title ?? 'Deleted video',
        creator: row.video_creator ?? '',
        status: row.video_status ?? 'removed',
      }
    : {
        kind: 'comment',
        id: row.comment_id ?? '',
        body: row.comment_body ?? '',
        author: row.comment_author ?? '',
        videoId: row.comment_video ?? '',
      }
  return {
    id: row.id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    resolution: row.resolution,
    createdAt: row.created_at.toISOString(),
    reporter: row.reporter,
    target,
  }
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
         (select coalesce(sum(amount_micro), 0) from payments where status <> 'failed' and created_at > now() - interval '24 hours') as volume24h,
         (select count(*)::int from reports where status = 'open') as reports`,
    )
    const overview: AdminOverview = {
      users: row?.users ?? 0,
      videos: row?.videos ?? 0,
      removedVideos: row?.removed ?? 0,
      sessions24h: row?.sessions24h ?? 0,
      volumeTotalMicro: row?.volume ?? 0,
      volume24hMicro: row?.volume24h ?? 0,
      openReports: row?.reports ?? 0,
    }
    sendJson(ctx.res, 200, { overview })
  })

  router.get('/admin/reports', 'required', async (ctx) => {
    requireAdmin(ctx)
    const status = ctx.url.searchParams.get('status') === 'resolved' ? 'resolved' : 'open'
    const rows = await query<ReportRow>(
      `select r.id, r.reason, r.details, r.status, r.resolution, r.created_at, r.reporter,
         v.id as video_id, v.title as video_title, v.creator as video_creator, v.status as video_status,
         c.id as comment_id, c.body as comment_body, c.author as comment_author, c.video_id as comment_video
       from reports r
       left join videos v on v.id = r.video_id
       left join comments c on c.id = r.comment_id
       where r.status = $1 order by r.created_at desc limit 100`,
      [status],
    )
    sendJson(ctx.res, 200, { reports: rows.map(mapReport) })
  })

  router.post('/admin/reports/:id/resolve', 'required', async (ctx) => {
    const admin = requireAdmin(ctx)
    const body = await readJson(ctx.req, 4 * 1024)
    const action = body.action === 'remove' ? 'remove' : body.action === 'dismiss' ? 'dismiss' : null
    if (!action) throw new HttpError(400, 'Choose remove or dismiss', 'invalid_request')
    const report = await queryOne<{ id: string; video_id: string | null; comment_id: string | null }>(
      `select id, video_id, comment_id from reports where id = $1 and status = 'open'`,
      [uuid(ctx.params.id ?? '')],
    )
    if (!report) throw new HttpError(404, 'Report not found', 'not_found')
    if (action === 'remove') {
      if (report.video_id) await query(`update videos set status = 'removed', updated_at = now() where id = $1`, [report.video_id])
      if (report.comment_id) await query('update comments set removed = true where id = $1', [report.comment_id])
    }
    // Resolve every open report about the same item at once.
    await query(
      `update reports set status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = now()
       where status = 'open' and (video_id = $1 or comment_id = $4)`,
      [report.video_id, action === 'remove' ? 'removed' : 'dismissed', admin, report.comment_id],
    )
    sendJson(ctx.res, 200, { ok: true })
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
