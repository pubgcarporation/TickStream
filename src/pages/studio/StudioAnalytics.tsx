import { useState } from 'react'
import type { CreatorAnalytics } from '@shared/types'
import { StatCard } from '@/components/creator/EarningsChart'
import { EmptyState, Panel, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { formatDuration, formatMicro } from '@/lib/format'

const BUCKETS = ['Under 25%', '25 to 50%', '50 to 75%', '75% or more']

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values)
  return (
    <ul className="space-y-3">
      {values.map((value, index) => (
        <li key={labels[index]} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
          <span className="text-[var(--muted)]">{labels[index]}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${(value / max) * 100}%`, transition: 'width 0.4s' }} />
          </div>
          <span className="text-right tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  )
}

export function StudioAnalytics() {
  const { data, loading } = useApi<{ analytics: CreatorAnalytics }>('creator/analytics')
  const [selected, setSelected] = useState<string | null>(null)
  if (loading && !data) return <Skeleton className="h-96" />
  const analytics = data?.analytics
  if (!analytics || analytics.videos.length === 0) {
    return <EmptyState title="No analytics yet" body="Once people pay to watch your videos, viewers, watch time and completion show up here." />
  }

  const video = analytics.videos.find((item) => item.videoId === selected) ?? analytics.videos[0]
  if (!video) return null
  const totalViewers = analytics.videos.reduce((sum, item) => sum + item.viewers, 0)
  const totalSessions = analytics.videos.reduce((sum, item) => sum + item.sessions, 0)
  const maxDaily = Math.max(1, ...analytics.dailyViewers.map((day) => day.viewers))

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paying viewers" value={String(totalViewers)} hint="Counted per video" />
        <StatCard label="Paid sessions" value={String(totalSessions)} />
        <StatCard label="Videos" value={String(analytics.videos.length)} />
      </div>

      <Panel>
        <h2 className="display mb-5 text-xl font-semibold">Paying viewers per day</h2>
        {analytics.dailyViewers.every((day) => day.viewers === 0) ? (
          <p className="py-8 text-center text-sm text-[var(--muted)]">No paid sessions in the last 14 days.</p>
        ) : (
          <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Paying viewers per day">
            {analytics.dailyViewers.map((day) => (
              <div key={day.day} className="group relative flex h-full flex-1 items-end">
                <div className="w-full rounded-t-md bg-[var(--accent)]/70 group-hover:bg-[var(--accent)]" style={{ height: `${Math.max(2, (day.viewers / maxDaily) * 100)}%` }} />
                <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-black/80 px-2 py-1 text-[10px] tabular-nums group-hover:block">
                  {day.day.slice(5)}: {day.viewers}
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <Panel>
          <h2 className="display mb-3 text-xl font-semibold">Videos</h2>
          <ul className="space-y-1" role="listbox" aria-label="Choose a video">
            {analytics.videos.map((item) => (
              <li key={item.videoId}>
                <button
                  role="option"
                  aria-selected={item.videoId === video.videoId}
                  onClick={() => setSelected(item.videoId)}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-colors ${
                    item.videoId === video.videoId ? 'bg-white/10' : 'hover:bg-white/5'
                  }`}
                >
                  <span className="truncate font-medium">{item.title}</span>
                  <span className="shrink-0 tabular-nums text-[var(--subtle)]">{item.viewers} viewers</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="space-y-6">
          <h2 className="display truncate text-xl font-semibold">{video.title}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-[var(--subtle)]">Views</p>
              <p className="display mt-1 text-2xl font-bold tabular-nums">{video.views}</p>
            </div>
            <div>
              <p className="text-[var(--subtle)]">Avg watched</p>
              <p className="display mt-1 text-2xl font-bold tabular-nums">{formatDuration(video.avgWatchSeconds)}</p>
            </div>
            <div>
              <p className="text-[var(--subtle)]">Avg completion</p>
              <p className="display mt-1 text-2xl font-bold tabular-nums">{video.avgCompletionPercent}%</p>
            </div>
            <div>
              <p className="text-[var(--subtle)]">Earned</p>
              <p className="display mt-1 text-2xl font-bold tabular-nums">{formatMicro(video.earnedMicro)}</p>
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">How much of the video each session paid for</h3>
            {video.sessions === 0 ? (
              <p className="text-sm text-[var(--muted)]">No paid sessions yet.</p>
            ) : (
              <Bars values={video.completion} labels={BUCKETS} />
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
