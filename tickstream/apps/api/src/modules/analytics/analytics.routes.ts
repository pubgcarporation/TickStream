import { query } from '@shared/db'
import type { CreatorAnalytics, VideoAnalytics } from '@shared/types'
import { requireUser, sendJson, type Router } from '../../http'

interface VideoRow {
  video_id: string
  title: string
  views: number
  duration: number | null
  sessions: number
  viewers: number
  avg_seconds: number
  avg_completion: number
  earned: number
  b1: number
  b2: number
  b3: number
  b4: number
}

interface DailyRow {
  day: string
  viewers: number
}

/**
 * Creator analytics from real sessions and payments. A session counts only once it has paid for something,
 * and "completion" is the share of the video that session paid for.
 */
export function registerAnalyticsRoutes(router: Router): void {
  router.get('/creator/analytics', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const rows = await query<VideoRow>(
      `with per_session as (
         select s.video_id, s.viewer,
           (s.segments_authorized * v.segment_seconds)::float as seconds,
           least(1.0, (s.segments_authorized * v.segment_seconds)::float / nullif(v.duration_seconds, 0)) as completion
         from playback_sessions s join videos v on v.id = s.video_id
         where v.creator = $1 and s.spent_micro > 0
       )
       select v.id as video_id, v.title, v.views, v.duration_seconds as duration,
         count(ps.viewer)::int as sessions,
         count(distinct ps.viewer)::int as viewers,
         coalesce(avg(ps.seconds), 0)::float as avg_seconds,
         coalesce(avg(ps.completion), 0)::float * 100 as avg_completion,
         coalesce((select sum(p.amount_micro) from payments p where p.video_id = v.id and p.status <> 'failed'), 0) as earned,
         count(*) filter (where ps.completion < 0.25)::int as b1,
         count(*) filter (where ps.completion >= 0.25 and ps.completion < 0.5)::int as b2,
         count(*) filter (where ps.completion >= 0.5 and ps.completion < 0.75)::int as b3,
         count(*) filter (where ps.completion >= 0.75)::int as b4
       from videos v left join per_session ps on ps.video_id = v.id
       where v.creator = $1 and v.status <> 'removed'
       group by v.id order by earned desc, v.created_at desc`,
      [addr],
    )
    const daily = await query<DailyRow>(
      `select to_char(d.day, 'YYYY-MM-DD') as day, count(distinct s.viewer)::int as viewers
       from generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') as d(day)
       left join (
         select s.viewer, s.started_at from playback_sessions s join videos v on v.id = s.video_id
         where v.creator = $1 and s.spent_micro > 0
       ) s on date_trunc('day', s.started_at) = d.day
       group by d.day order by d.day`,
      [addr],
    )
    const videos: VideoAnalytics[] = rows.map((row) => ({
      videoId: row.video_id,
      title: row.title,
      views: row.views,
      sessions: row.sessions,
      viewers: row.viewers,
      avgWatchSeconds: Math.round(row.avg_seconds),
      avgCompletionPercent: Math.round(row.avg_completion),
      earnedMicro: row.earned,
      completion: [row.b1, row.b2, row.b3, row.b4],
    }))
    const analytics: CreatorAnalytics = { videos, dailyViewers: daily.map((row) => ({ day: row.day, viewers: row.viewers })) }
    sendJson(ctx.res, 200, { analytics })
  })
}
