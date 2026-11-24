import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CreatorAnalytics, VideoAnalytics, VideoSummary } from '@shared/types'
import { Button, Card, EmptyState, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro } from '@/lib/format'
import { Link } from '@/lib/router'

const BUCKETS = ['Under 25%', '25 to 50%', '50 to 75%', '75% or more']

type SortKey = 'title' | 'views' | 'viewers' | 'avgWatchSeconds' | 'avgCompletionPercent' | 'earnedMicro'

interface Row extends VideoAnalytics {
  status: VideoSummary['status'] | null
  durationSeconds: number | null
  priceMicro: number | null
  createdAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  ready: 'Live',
  processing: 'Encoding',
  uploading: 'Waiting for file',
  failed: 'Failed',
}

function Thumb({ videoId, className }: { videoId: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`aspect-video shrink-0 overflow-hidden rounded-md bg-[var(--surface-muted)] ${className ?? ''}`}>
      {!broken && <img src={thumbnailUrl(videoId)} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />}
    </div>
  )
}

function Kpi({ label, value, unit, hint }: { label: string; value: string; unit?: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-[var(--subtle)]">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1.5 text-sm font-medium text-[var(--subtle)]">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
    </Card>
  )
}

function DailyChart({ days }: { days: CreatorAnalytics['dailyViewers'] }) {
  const max = Math.max(1, ...days.map((day) => day.viewers))
  const total = days.reduce((sum, day) => sum + day.viewers, 0)
  const middle = days[Math.floor(days.length / 2)]
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Paying viewers</h2>
          <p className="text-xs text-[var(--muted)]">Last 14 days, counted per day</p>
        </div>
        <p className="text-sm tabular-nums text-[var(--muted)]">
          <span className="text-lg font-semibold text-[var(--ink)]">{total}</span> in total
        </p>
      </div>
      {total === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] py-10 text-center text-sm text-[var(--muted)]">No paid sessions in the last 14 days.</p>
      ) : (
        <figure>
          <div className="relative flex h-40 items-end gap-1.5 border-b border-[var(--border)]" role="img" aria-label="Paying viewers per day for the last 14 days">
            <span className="absolute -top-0.5 left-0 text-[10px] tabular-nums text-[var(--subtle)]">{max}</span>
            {days.map((day) => (
              <div key={day.day} className="group relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-sm bg-[var(--accent)]/65 transition-colors group-hover:bg-[var(--accent)]"
                  style={{ height: `${day.viewers === 0 ? 1 : Math.max(4, (day.viewers / max) * 100)}%`, opacity: day.viewers === 0 ? 0.25 : 1 }}
                />
                <span className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-[var(--border)] bg-[#111] px-2 py-1 text-[11px] tabular-nums group-hover:block">
                  {day.day.slice(5)} · {day.viewers} {day.viewers === 1 ? 'viewer' : 'viewers'}
                </span>
              </div>
            ))}
          </div>
          <figcaption className="mt-2 flex justify-between text-[10px] tabular-nums text-[var(--subtle)]">
            <span>{days[0]?.day.slice(5)}</span>
            <span>{middle?.day.slice(5)}</span>
            <span>{days[days.length - 1]?.day.slice(5)}</span>
          </figcaption>
        </figure>
      )}
    </Card>
  )
}

function SortHead({ label, k, sort, dir, onSort, align = 'right' }: { label: string; k: SortKey; sort: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void; align?: 'left' | 'right' }) {
  const active = sort === k
  return (
    <th scope="col" aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-3 py-2.5 font-medium ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--ink)] ${active ? 'text-[var(--ink)]' : 'text-[var(--subtle)]'}`}
      >
        {label}
        {active && (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
      </button>
    </th>
  )
}

function CompletionBar({ percent }: { percent: number }) {
  return (
    <div className="ml-auto flex w-28 items-center justify-end gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <span className="w-9 text-right tabular-nums">{percent}%</span>
    </div>
  )
}

function Detail({ row }: { row: Row }) {
  const share = (value: number) => (row.sessions === 0 ? 0 : Math.round((value / row.sessions) * 100))
  const perViewer = row.viewers > 0 ? Math.round(row.earnedMicro / row.viewers) : 0
  const tiles: Array<[string, string]> = [
    ['Views', String(row.views)],
    ['Paying viewers', String(row.viewers)],
    ['Paid sessions', String(row.sessions)],
    ['Avg watched', row.sessions === 0 ? '--' : formatDuration(row.avgWatchSeconds)],
    ['Avg completion', row.sessions === 0 ? '--' : `${row.avgCompletionPercent}%`],
    ['Earned', `${formatMicro(row.earnedMicro)} USDC`],
  ]
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Thumb videoId={row.videoId} className="w-32" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{row.title}</h2>
          <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">
            {[row.status ? STATUS_LABEL[row.status] : null, row.durationSeconds ? formatDuration(row.durationSeconds) : null, row.priceMicro ? `$${formatMicro(row.priceMicro)}/s` : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <div className="flex gap-2">
          {row.status === 'ready' && (
            <Link to={`/watch/${row.videoId}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] px-3.5 text-sm font-semibold hover:bg-white/10">
              Watch <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
          <Link to="/studio/videos" className="inline-flex min-h-10 items-center rounded-lg border border-[var(--border)] px-3.5 text-sm font-semibold hover:bg-white/10">
            Manage
          </Link>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--border)] sm:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="bg-[var(--surface)] p-3.5">
            <dt className="text-xs text-[var(--subtle)]">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <h3 className="text-sm font-semibold">How much of the video each session paid for</h3>
        {row.sessions === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--border)] py-6 text-center text-sm text-[var(--muted)]">No paid sessions yet. This fills in once someone pays to watch.</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {row.completion.map((value, index) => (
              <li key={BUCKETS[index]} className="grid grid-cols-[6.5rem_1fr_6rem] items-center gap-3 text-sm">
                <span className="text-[var(--muted)]">{BUCKETS[index]}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${share(value)}%`, transition: 'width 0.4s' }} />
                </div>
                <span className="text-right tabular-nums">
                  {value} <span className="text-[var(--subtle)]">({share(value)}%)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        {perViewer > 0 && <p className="mt-4 text-xs text-[var(--muted)]">About {formatMicro(perViewer)} USDC earned per paying viewer.</p>}
      </div>
    </Card>
  )
}

export function StudioAnalytics() {
  const analyticsQuery = useApi<{ analytics: CreatorAnalytics }>('creator/analytics')
  const videosQuery = useApi<{ videos: VideoSummary[] }>('me/videos')
  const [selected, setSelected] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>('earnedMicro')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')

  const analytics = analyticsQuery.data?.analytics
  const rows = useMemo<Row[]>(() => {
    if (!analytics) return []
    const meta = new Map((videosQuery.data?.videos ?? []).map((video) => [video.id, video]))
    const merged = analytics.videos.map((item) => {
      const info = meta.get(item.videoId)
      return { ...item, status: info?.status ?? null, durationSeconds: info?.durationSeconds ?? null, priceMicro: info?.priceMicro ?? null, createdAt: info?.createdAt ?? null }
    })
    const factor = dir === 'asc' ? 1 : -1
    return merged.sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) * factor : (a[sort] - b[sort]) * factor))
  }, [analytics, videosQuery.data, sort, dir])

  if (analyticsQuery.loading && !analytics) {
    return (
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (!analytics) {
    return (
      <EmptyState
        title="Could not load analytics"
        body={analyticsQuery.error?.message ?? 'Check your connection and try again.'}
        action={
          <Button shape="rect" variant="secondary" onClick={analyticsQuery.reload}>
            Try again
          </Button>
        }
      />
    )
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No videos yet"
        body="Upload a video and set a price per second. Views, paying viewers, watch time and earnings for each video show up here."
        action={
          <Link to="/studio/upload" className="inline-flex min-h-10 items-center rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)]">
            Upload a video
          </Link>
        }
      />
    )
  }

  const current = rows.find((row) => row.videoId === selected) ?? rows[0]
  if (!current) return null
  const totalEarned = rows.reduce((sum, row) => sum + row.earnedMicro, 0)
  const totalViews = rows.reduce((sum, row) => sum + row.views, 0)
  const totalViewers = rows.reduce((sum, row) => sum + row.viewers, 0)
  const totalSessions = rows.reduce((sum, row) => sum + row.sessions, 0)
  const avgCompletion = totalSessions === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.avgCompletionPercent * row.sessions, 0) / totalSessions)
  const avgWatch = totalSessions === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.avgWatchSeconds * row.sessions, 0) / totalSessions)

  const onSort = (key: SortKey) => {
    if (key === sort) setDir((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'title' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Total earned" value={formatMicro(totalEarned)} unit="USDC" />
        <Kpi label="Views" value={String(totalViews)} hint={`${rows.length} ${rows.length === 1 ? 'video' : 'videos'}`} />
        <Kpi label="Paying viewers" value={String(totalViewers)} hint={`${totalSessions} paid ${totalSessions === 1 ? 'session' : 'sessions'}, counted per video`} />
        <Kpi label="Avg completion" value={totalSessions === 0 ? '--' : `${avgCompletion}%`} hint={totalSessions === 0 ? 'Waiting for the first paid session' : `${formatDuration(avgWatch)} watched on average`} />
      </div>

      <DailyChart days={analytics.dailyViewers} />

      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="text-base font-semibold">Your videos</h2>
          <p className="text-xs text-[var(--muted)]">Select a video for its breakdown</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-y border-[var(--border)] bg-black/20">
              <tr>
                <SortHead label="Video" k="title" sort={sort} dir={dir} onSort={onSort} align="left" />
                <SortHead label="Views" k="views" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Paying viewers" k="viewers" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Avg watched" k="avgWatchSeconds" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Completion" k="avgCompletionPercent" sort={sort} dir={dir} onSort={onSort} />
                <SortHead label="Earned (USDC)" k="earnedMicro" sort={sort} dir={dir} onSort={onSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] tabular-nums">
              {rows.map((row) => {
                const active = row.videoId === current.videoId
                return (
                  <tr
                    key={row.videoId}
                    onClick={() => setSelected(row.videoId)}
                    className={`cursor-pointer transition-colors ${active ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
                    aria-selected={active}
                  >
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setSelected(row.videoId)} className="flex w-full min-w-0 items-center gap-3 text-left" aria-pressed={active}>
                        <Thumb videoId={row.videoId} className="w-24" />
                        <span className="min-w-0">
                          <span className="block max-w-[16rem] truncate font-medium">{row.title}</span>
                          <span className="block text-xs text-[var(--subtle)]">
                            {[row.status ? STATUS_LABEL[row.status] : null, row.durationSeconds ? formatDuration(row.durationSeconds) : null].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">{row.views}</td>
                    <td className="px-3 py-2.5 text-right">{row.viewers}</td>
                    <td className="px-3 py-2.5 text-right">{row.sessions === 0 ? '--' : formatDuration(row.avgWatchSeconds)}</td>
                    <td className="px-3 py-2.5">{row.sessions === 0 ? <span className="block text-right text-[var(--subtle)]">--</span> : <CompletionBar percent={row.avgCompletionPercent} />}</td>
                    <td className="px-3 py-2.5 text-right font-medium">{formatMicro(row.earnedMicro)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Detail row={current} />
    </div>
  )
}
