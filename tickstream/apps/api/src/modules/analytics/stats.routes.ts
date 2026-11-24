import { query } from '@shared/db'
import type { StudioDay, StudioStats, StudioSupporter, StudioTotals, StudioVideoStats, VideoStatus } from '@shared/types'
import { HttpError, requireUser, sendJson, type Router } from '../../http'
import { int } from '../../middleware/request-validation'

interface DayRow {
  day: string
  watch: number
  tips: number
  seconds: number
  starts: number
  paid: number
  viewers: number
}

interface PaymentTotalsRow {
  cur_watch: number
  cur_tips: number
  cur_seconds: number
  prev_watch: number
  prev_tips: number
  prev_seconds: number
  pending: number
  settled: number
}

interface SessionTotalsRow {
  cur_starts: number
  cur_paid: number
  cur_viewers: number
  prev_starts: number
  prev_paid: number
  prev_viewers: number
  returning: number
}

interface VideoRow {
  id: string
  title: string
  status: VideoStatus
  price_micro: number
  duration_seconds: number | null
  created_at: Date
  views: number
  watch: number
  tips: number
  seconds: number
}

interface VideoSessionRow {
  video_id: string
  starts: number
  viewers: number
  completion: number
  b1: number
  b2: number
  b3: number
  b4: number
}

interface SupporterRow {
  payer: string
  total: number
  payments: number
  tips: number
}

const DAY_MS = 86_400_000
const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 366

const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** A YYYY-MM-DD query value that is a real calendar day. */
function dayParam(value: string, field: string): string {
  if (!DATE.test(value) || toDay(toMs(value)) !== value) {
    throw new HttpError(400, `${field} must be a day like 2026-01-31`, 'invalid_request')
  }
  return value
}

/**
 * One request that backs every Studio screen. Everything is counted from real payments and viewing sessions of this
 * creator's videos. A period is either the last N days (`days`, UTC, today included) or an exact range (`from` and
 * `to`, both included). It is compared with the period of the same length right before it.
 */
export function registerStudioStatsRoutes(router: Router): void {
  router.get('/creator/stats', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const params = ctx.url.searchParams

    // Today comes from the database, so the period and the rows it counts always agree on where a day starts.
    const [clock] = await query<{ today: string }>(`select to_char(date_trunc('day', now()), 'YYYY-MM-DD') as today`)
    const today = clock?.today ?? toDay(Date.now())

    let fromDay: string
    let toDayStr: string
    if (params.has('from') || params.has('to')) {
      toDayStr = dayParam(params.get('to') ?? today, 'to')
      fromDay = dayParam(params.get('from') ?? toDayStr, 'from')
      if (toMs(toDayStr) > toMs(today)) toDayStr = today
      if (toMs(fromDay) > toMs(toDayStr)) throw new HttpError(400, 'from must not be after to', 'invalid_request')
      if ((toMs(toDayStr) - toMs(fromDay)) / DAY_MS + 1 > MAX_DAYS) {
        throw new HttpError(400, `A period can cover at most ${MAX_DAYS} days`, 'invalid_request')
      }
    } else {
      const requested = int(params.get('days') ?? '28', 'days', 1, 365)
      toDayStr = today
      fromDay = toDay(toMs(today) - (requested - 1) * DAY_MS)
    }
    const days = (toMs(toDayStr) - toMs(fromDay)) / DAY_MS + 1
    const previousFrom = toDay(toMs(fromDay) - days * DAY_MS)
    const previousTo = toDay(toMs(fromDay) - DAY_MS)

    // Period bounds, computed once by the database so every query below agrees on them. `end` is the first
    // moment after the last day, so a range can stop before today.
    const [bounds] = await query<{ cur: string; prev: string; end: string }>(
      `select ($1::date)::timestamptz::text as cur, ($2::date)::timestamptz::text as prev,
              (($3::date) + interval '1 day')::timestamptz::text as "end"`,
      [fromDay, previousFrom, toDayStr],
    )
    const cur = bounds?.cur ?? ''
    const prev = bounds?.prev ?? ''
    const end = bounds?.end ?? ''

    const [dayRows, payTotals, sessionTotals, videoRows, videoSessions, supporterRows] = await Promise.all([
      query<DayRow>(
        `select to_char(d.day, 'YYYY-MM-DD') as day,
           coalesce(p.watch, 0) as watch, coalesce(p.tips, 0) as tips, coalesce(p.seconds, 0) as seconds,
           coalesce(s.starts, 0)::int as starts, coalesce(s.paid, 0)::int as paid, coalesce(s.viewers, 0)::int as viewers
         from generate_series($2::timestamptz, $3::timestamptz - interval '1 day', interval '1 day') as d(day)
         left join (
           select date_trunc('day', created_at) as day,
             sum(amount_micro) filter (where kind = 'watch') as watch,
             sum(amount_micro) filter (where kind = 'tip') as tips,
             sum(seconds) filter (where kind = 'watch') as seconds
           from payments where creator = $1 and status <> 'failed' and created_at >= $2::timestamptz and created_at < $3::timestamptz group by 1
         ) p on p.day = d.day
         left join (
           select date_trunc('day', s.started_at) as day, count(*) as starts,
             count(*) filter (where s.spent_micro > 0) as paid,
             count(distinct s.viewer) filter (where s.spent_micro > 0) as viewers
           from playback_sessions s join videos v on v.id = s.video_id
           where v.creator = $1 and s.started_at >= $2::timestamptz and s.started_at < $3::timestamptz group by 1
         ) s on s.day = d.day
         order by d.day`,
        [addr, cur, end],
      ),
      query<PaymentTotalsRow>(
        `select
           coalesce(sum(amount_micro) filter (where kind = 'watch' and created_at >= $2::timestamptz and created_at < $4::timestamptz), 0) as cur_watch,
           coalesce(sum(amount_micro) filter (where kind = 'tip' and created_at >= $2::timestamptz and created_at < $4::timestamptz), 0) as cur_tips,
           coalesce(sum(seconds) filter (where kind = 'watch' and created_at >= $2::timestamptz and created_at < $4::timestamptz), 0) as cur_seconds,
           coalesce(sum(amount_micro) filter (where kind = 'watch' and created_at < $2::timestamptz), 0) as prev_watch,
           coalesce(sum(amount_micro) filter (where kind = 'tip' and created_at < $2::timestamptz), 0) as prev_tips,
           coalesce(sum(seconds) filter (where kind = 'watch' and created_at < $2::timestamptz), 0) as prev_seconds,
           coalesce(sum(amount_micro) filter (where status = 'pending' and created_at >= $2::timestamptz and created_at < $4::timestamptz), 0) as pending,
           coalesce(sum(amount_micro) filter (where status = 'settled' and created_at >= $2::timestamptz and created_at < $4::timestamptz), 0) as settled
         from payments where creator = $1 and status <> 'failed' and created_at >= $3::timestamptz and created_at < $4::timestamptz`,
        [addr, cur, prev, end],
      ),
      query<SessionTotalsRow>(
        `select
           count(*) filter (where s.started_at >= $2::timestamptz and s.started_at < $4::timestamptz)::int as cur_starts,
           count(*) filter (where s.started_at >= $2::timestamptz and s.started_at < $4::timestamptz and s.spent_micro > 0)::int as cur_paid,
           count(distinct s.viewer) filter (where s.started_at >= $2::timestamptz and s.started_at < $4::timestamptz and s.spent_micro > 0)::int as cur_viewers,
           count(*) filter (where s.started_at < $2::timestamptz)::int as prev_starts,
           count(*) filter (where s.started_at < $2::timestamptz and s.spent_micro > 0)::int as prev_paid,
           count(distinct s.viewer) filter (where s.started_at < $2::timestamptz and s.spent_micro > 0)::int as prev_viewers,
           (select count(*)::int from (
              select s2.viewer from playback_sessions s2 join videos v2 on v2.id = s2.video_id
              where v2.creator = $1 and s2.started_at >= $2::timestamptz and s2.started_at < $4::timestamptz and s2.spent_micro > 0
              group by s2.viewer having count(*) > 1) r) as returning
         from playback_sessions s join videos v on v.id = s.video_id
         where v.creator = $1 and s.started_at >= $3::timestamptz and s.started_at < $4::timestamptz`,
        [addr, cur, prev, end],
      ),
      query<VideoRow>(
        `select v.id, v.title, v.status, v.price_micro, v.duration_seconds, v.created_at, v.views,
           coalesce(sum(p.amount_micro) filter (where p.kind = 'watch'), 0) as watch,
           coalesce(sum(p.amount_micro) filter (where p.kind = 'tip'), 0) as tips,
           coalesce(sum(p.seconds) filter (where p.kind = 'watch'), 0) as seconds
         from videos v
         left join payments p on p.video_id = v.id and p.status <> 'failed' and p.created_at >= $2::timestamptz and p.created_at < $3::timestamptz
         where v.creator = $1 and v.status <> 'removed'
         group by v.id order by watch desc, v.created_at desc`,
        [addr, cur, end],
      ),
      query<VideoSessionRow>(
        `with per_session as (
           select s.video_id, s.viewer, s.spent_micro,
             least(1.0, (s.segments_authorized * v.segment_seconds)::float / nullif(v.duration_seconds, 0)) as completion
           from playback_sessions s join videos v on v.id = s.video_id
           where v.creator = $1 and s.started_at >= $2::timestamptz and s.started_at < $3::timestamptz
         )
         select video_id, count(*)::int as starts,
           count(distinct viewer) filter (where spent_micro > 0)::int as viewers,
           coalesce(avg(completion) filter (where spent_micro > 0), 0)::float * 100 as completion,
           count(*) filter (where spent_micro > 0 and completion < 0.25)::int as b1,
           count(*) filter (where spent_micro > 0 and completion >= 0.25 and completion < 0.5)::int as b2,
           count(*) filter (where spent_micro > 0 and completion >= 0.5 and completion < 0.75)::int as b3,
           count(*) filter (where spent_micro > 0 and completion >= 0.75)::int as b4
         from per_session group by video_id`,
        [addr, cur, end],
      ),
      query<SupporterRow>(
        `select payer, sum(amount_micro) as total, count(*)::int as payments,
           coalesce(sum(amount_micro) filter (where kind = 'tip'), 0) as tips
         from payments where creator = $1 and status <> 'failed' and created_at >= $2::timestamptz and created_at < $3::timestamptz
         group by payer order by total desc limit 8`,
        [addr, cur, end],
      ),
    ])

    const pay = payTotals[0]
    const sess = sessionTotals[0]
    const sessionByVideo = new Map(videoSessions.map((row) => [row.video_id, row]))

    const series: StudioDay[] = dayRows.map((row) => ({
      day: row.day,
      watchMicro: row.watch,
      tipsMicro: row.tips,
      paidSeconds: row.seconds,
      starts: row.starts,
      paidSessions: row.paid,
      payingViewers: row.viewers,
    }))
    const current: StudioTotals = {
      watchMicro: pay?.cur_watch ?? 0,
      tipsMicro: pay?.cur_tips ?? 0,
      paidSeconds: pay?.cur_seconds ?? 0,
      starts: sess?.cur_starts ?? 0,
      paidSessions: sess?.cur_paid ?? 0,
      payingViewers: sess?.cur_viewers ?? 0,
    }
    const previous: StudioTotals = {
      watchMicro: pay?.prev_watch ?? 0,
      tipsMicro: pay?.prev_tips ?? 0,
      paidSeconds: pay?.prev_seconds ?? 0,
      starts: sess?.prev_starts ?? 0,
      paidSessions: sess?.prev_paid ?? 0,
      payingViewers: sess?.prev_viewers ?? 0,
    }
    const videos: StudioVideoStats[] = videoRows.map((row) => {
      const live = sessionByVideo.get(row.id)
      return {
        videoId: row.id,
        title: row.title,
        status: row.status,
        priceMicro: row.price_micro,
        durationSeconds: row.duration_seconds,
        createdAt: row.created_at.toISOString(),
        lifetimeViews: row.views,
        starts: live?.starts ?? 0,
        payingViewers: live?.viewers ?? 0,
        watchMicro: row.watch,
        tipsMicro: row.tips,
        paidSeconds: row.seconds,
        avgCompletionPercent: Math.round(live?.completion ?? 0),
        completion: [live?.b1 ?? 0, live?.b2 ?? 0, live?.b3 ?? 0, live?.b4 ?? 0],
      }
    })
    const supporters: StudioSupporter[] = supporterRows.map((row) => ({ payer: row.payer, totalMicro: row.total, payments: row.payments, tipsMicro: row.tips }))

    const stats: StudioStats = {
      days,
      from: fromDay,
      to: toDayStr,
      previousFrom,
      previousTo,
      series,
      current,
      previous,
      returningViewers: sess?.returning ?? 0,
      videos,
      supporters,
      settlement: { pendingMicro: pay?.pending ?? 0, settledMicro: pay?.settled ?? 0 },
    }
    sendJson(ctx.res, 200, { stats })
  })
}
