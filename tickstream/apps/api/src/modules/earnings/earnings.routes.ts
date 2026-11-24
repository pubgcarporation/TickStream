import { query } from '@shared/db'
import type { EarningsSummary, PaymentRecord } from '@shared/types'
import { HttpError, requireUser, sendJson, type Router } from '../../http'
import { int } from '../../middleware/request-validation'

interface TotalsRow {
  total: number
  last24h: number
  seconds: number
  pending: number
  settled: number
}

interface PerVideoRow {
  video_id: string
  title: string
  earned: number
  seconds: number
  views: number
}

interface DailyRow {
  day: string
  earned: number
  seconds: number
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
  kind: PaymentRecord['kind']
  message: string | null
}

interface HistoryRow {
  id: string
  video_id: string
  title: string
  username: string
  display_name: string | null
  spent_micro: number
  seconds: number
  started_at: Date
  status: string
  last_position: number
  duration_seconds: number | null
}

export function registerEarningsRoutes(router: Router): void {
  router.get('/creator/earnings', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const [totals] = await query<TotalsRow>(
      `select
         coalesce(sum(amount_micro) filter (where status <> 'failed'), 0) as total,
         coalesce(sum(amount_micro) filter (where status <> 'failed' and created_at > now() - interval '24 hours'), 0) as last24h,
         coalesce(sum(seconds) filter (where status <> 'failed'), 0) as seconds,
         coalesce(sum(amount_micro) filter (where status = 'pending'), 0) as pending,
         coalesce(sum(amount_micro) filter (where status = 'settled'), 0) as settled
       from payments where creator = $1`,
      [addr],
    )
    const perVideo = await query<PerVideoRow>(
      `select v.id as video_id, v.title, v.views,
         coalesce(sum(p.amount_micro) filter (where p.status <> 'failed'), 0) as earned,
         coalesce(sum(p.seconds) filter (where p.status <> 'failed'), 0) as seconds
       from videos v left join payments p on p.video_id = v.id
       where v.creator = $1 and v.status <> 'removed'
       group by v.id order by earned desc, v.created_at desc`,
      [addr],
    )
    const daily = await query<DailyRow>(
      `select to_char(d.day, 'YYYY-MM-DD') as day,
         coalesce(sum(p.amount_micro) filter (where p.status <> 'failed'), 0) as earned,
         coalesce(sum(p.seconds) filter (where p.status <> 'failed'), 0) as seconds
       from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d(day)
       left join payments p on p.creator = $1 and date_trunc('day', p.created_at) = d.day
       group by d.day order by d.day`,
      [addr],
    )
    const summary: EarningsSummary = {
      totalMicro: totals?.total ?? 0,
      last24hMicro: totals?.last24h ?? 0,
      secondsSold: totals?.seconds ?? 0,
      pendingMicro: totals?.pending ?? 0,
      settledMicro: totals?.settled ?? 0,
      perVideo: perVideo.map((row) => ({
        videoId: row.video_id,
        title: row.title,
        earnedMicro: row.earned,
        secondsSold: row.seconds,
        views: row.views,
      })),
      daily: daily.map((row) => ({ day: row.day, earnedMicro: row.earned, secondsSold: row.seconds })),
    }
    sendJson(ctx.res, 200, { summary })
  })

  router.get('/creator/payments', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const limit = int(ctx.url.searchParams.get('limit') ?? '50', 'limit', 1, 100)
    const offset = int(ctx.url.searchParams.get('offset') ?? '0', 'offset', 0, 100_000)
    // Optional period (both days included, UTC) and kind/status filter. Both are checked, never pasted into the query.
    const day = (name: string) => {
      const value = ctx.url.searchParams.get(name)
      if (value === null || value === '') return null
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
        throw new HttpError(400, `${name} must be a day like 2026-01-31`, 'invalid_request')
      }
      return value
    }
    const from = day('from')
    const to = day('to')
    if (from && to && from > to) throw new HttpError(400, 'from must not be after to', 'invalid_request')
    const filters: Record<string, string> = {
      all: 'true',
      watch: "p.kind = 'watch'",
      tip: "p.kind = 'tip'",
      pending: "p.status = 'pending'",
      failed: "p.status = 'failed'",
    }
    const filterName = ctx.url.searchParams.get('filter') ?? 'all'
    const filterSql = Object.hasOwn(filters, filterName) ? filters[filterName] : undefined
    if (!filterSql) throw new HttpError(400, 'filter must be all, watch, tip, pending or failed', 'invalid_request')
    // One extra row tells the page whether there is more to load.
    const rows = await query<PaymentRow>(
      `select p.id, p.video_id, v.title, p.payer, p.amount_micro, p.seconds, p.status, p.transfer_id, p.created_at, p.kind, p.message
       from payments p join videos v on v.id = p.video_id
       where p.creator = $1
         and ($4::date is null or p.created_at >= $4::date::timestamptz)
         and ($5::date is null or p.created_at < ($5::date + interval '1 day')::timestamptz)
         and ${filterSql}
       order by p.created_at desc, p.id desc limit $2 offset $3`,
      [addr, limit + 1, offset, from, to],
    )
    const more = rows.length > limit
    rows.length = Math.min(rows.length, limit)
    const payments: PaymentRecord[] = rows.map((row) => ({
      id: row.id,
      videoId: row.video_id,
      videoTitle: row.title,
      payer: row.payer,
      amountMicro: row.amount_micro,
      seconds: row.seconds,
      status: row.status,
      transferId: row.transfer_id,
      createdAt: row.created_at.toISOString(),
      kind: row.kind,
      message: row.message,
    }))
    sendJson(ctx.res, 200, { payments, more })
  })

  router.get('/me/history', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const rows = await query<HistoryRow>(
      `select s.id, s.video_id, v.title, u.username, u.display_name, s.spent_micro, s.segments_authorized * v.segment_seconds as seconds,
         s.started_at, s.status, s.last_position, v.duration_seconds
       from playback_sessions s join videos v on v.id = s.video_id join users u on u.address = v.creator
       where s.viewer = $1 and s.spent_micro > 0 order by s.started_at desc limit 60`,
      [addr],
    )
    sendJson(ctx.res, 200, {
      history: rows.map((row) => ({
        id: row.id,
        videoId: row.video_id,
        title: row.title,
        creator: row.username,
        creatorName: row.display_name,
        spentMicro: row.spent_micro,
        seconds: row.seconds,
        startedAt: row.started_at.toISOString(),
        status: row.status,
        positionSecond: row.last_position,
        durationSeconds: row.duration_seconds,
      })),
    })
  })
}
