import { History as HistoryIcon, Users } from 'lucide-react'
import type { CreatorSummary, VideoSummary } from '@shared/types'
import { RequireAuth } from '@/components/creator/RequireAuth'
import { EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro, timeAgo } from '@/lib/format'
import { Link, useLocation } from '@/lib/router'

interface HistoryItem {
  id: string
  videoId: string
  title: string
  creator: string
  spentMicro: number
  seconds: number
  startedAt: string
  positionSecond: number
  durationSeconds: number | null
}

interface WatchedVideo extends HistoryItem {
  /** What every session on this video cost together. */
  totalMicro: number
  sessions: number
}

/** One entry per video, newest first, with what all its sessions cost in total. */
function byVideo(history: HistoryItem[]): WatchedVideo[] {
  const seen = new Map<string, WatchedVideo>()
  for (const item of history) {
    const existing = seen.get(item.videoId)
    if (existing) {
      existing.totalMicro += item.spentMicro
      existing.sessions += 1
    } else {
      seen.set(item.videoId, { ...item, totalMicro: item.spentMicro, sessions: 1 })
    }
  }
  return [...seen.values()]
}

function dayLabel(iso: string): string {
  const day = new Date(iso)
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const diff = Math.round((start(new Date()) - start(day)) / 86_400_000)
  if (diff <= 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return day.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function History() {
  const { data, loading, error, reload } = useApi<{ history: HistoryItem[] }>('me/history')
  if (loading && !data) return <Skeleton className="h-64" />
  if (error && !data) return <ErrorState title="Could not load your history" message={error.message} onRetry={reload} />
  if (!data || data.history.length === 0) {
    return (
      <EmptyState
        icon={HistoryIcon}
        title="Nothing watched yet"
        body="Videos you pay to watch show up here with exactly what each one cost."
        action={
          <Link to="/explore" className="inline-flex min-h-10 items-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)]">
            Find something to watch
          </Link>
        }
      />
    )
  }
  const videos = byVideo(data.history)
  const total = data.history.reduce((sum, item) => sum + item.spentMicro, 0)
  const groups = new Map<string, WatchedVideo[]>()
  for (const video of videos) {
    const label = dayLabel(video.startedAt)
    groups.set(label, [...(groups.get(label) ?? []), video])
  }
  return (
    <div className="space-y-6">
      <p className="text-sm tabular-nums text-[var(--muted)]">
        {videos.length} {videos.length === 1 ? 'video' : 'videos'} watched recently, {formatMicro(total)} USDC in total.
      </p>
      {[...groups.entries()].map(([label, items]) => (
        <section key={label} aria-label={label}>
          <h2 className="mb-2 text-sm font-semibold">{label}</h2>
          <ul className="space-y-3">
            {items.map((item) => {
              const partial = item.durationSeconds ? item.positionSecond >= 10 && item.positionSecond < item.durationSeconds - 10 : false
              const progress = item.durationSeconds ? Math.min(100, (item.positionSecond / item.durationSeconds) * 100) : 0
              return (
                <li key={item.videoId} className="flex gap-3 sm:gap-4">
                  <Link to={`/watch/${item.videoId}`} className="relative block w-40 shrink-0 overflow-hidden rounded-lg bg-black sm:w-52" aria-label={`Watch ${item.title}`}>
                    <div className="aspect-video">
                      <img
                        src={thumbnailUrl(item.videoId)}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    </div>
                    {item.durationSeconds ? (
                      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">{formatDuration(item.durationSeconds)}</span>
                    ) : null}
                    {progress > 0 && (
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25" aria-hidden>
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </Link>
                  <div className="min-w-0 flex-1 py-0.5">
                    <Link to={`/watch/${item.videoId}`} className="line-clamp-2 text-pretty font-semibold leading-snug hover:underline">
                      {item.title}
                    </Link>
                    <p className="mt-1 truncate text-sm text-[var(--muted)]">
                      <Link to={`/profile/${item.creator}`} className="hover:text-[var(--ink)]">
                        {item.creator}
                      </Link>
                    </p>
                    <p className="mt-0.5 text-xs tabular-nums text-[var(--subtle)]">
                      {timeAgo(item.startedAt)}
                      {item.sessions > 1 ? ` · ${item.sessions} sessions` : ''}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                      <span className="font-semibold">
                        {formatMicro(item.totalMicro)} <span className="font-medium text-[var(--subtle)]">USDC</span>
                      </span>
                      {partial && (
                        <Link to={`/watch/${item.videoId}`} className="font-semibold text-[var(--accent)] hover:underline">
                          Resume at {formatDuration(item.positionSecond)}
                        </Link>
                      )}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Following() {
  const creators = useApi<{ creators: CreatorSummary[] }>('me/following')
  const feed = useApi<{ videos: VideoSummary[] }>('me/feed')
  if (creators.loading && !creators.data) return <Skeleton className="h-64" />
  if (creators.error && !creators.data) return <ErrorState title="Could not load who you follow" message={creators.error.message} onRetry={creators.reload} />
  if (!creators.data || creators.data.creators.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="You are not following anyone"
        body="Follow creators from a video or profile page to see their new videos here."
        action={
          <Link to="/explore" className="inline-flex min-h-10 items-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)]">
            Explore creators
          </Link>
        }
      />
    )
  }
  return (
    <div className="space-y-6">
      <ul className="flex flex-wrap gap-2" aria-label="Creators you follow">
        {creators.data.creators.map((creator) => (
          <li key={creator.address}>
            <Link to={`/profile/${creator.username}`} className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[var(--border)] px-3.5 text-sm font-medium hover:bg-white/10">
              {creator.displayName ?? creator.username}
              <span className="text-xs tabular-nums text-[var(--subtle)]">{creator.videos} videos</span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="latest" className="space-y-3">
        <h2 id="latest" className="text-lg font-semibold">
          Latest from creators you follow
        </h2>
        {feed.data && feed.data.videos.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing new yet.</p>
        ) : (
          <VideoGrid videos={feed.data?.videos ?? null} loading={feed.loading && !feed.data} error={feed.error} onRetry={feed.reload} />
        )}
      </section>
    </div>
  )
}

export function LibraryPage() {
  const { search } = useLocation()
  const tab: 'history' | 'following' = search.get('tab') === 'following' ? 'following' : 'history'
  return (
    <div className="space-y-4">
      <PageHeader title="Library" subtitle="Your watch history and the creators you follow." />
      <RequireAuth title="Sign in to see your library" body="Your watch history and the creators you follow are tied to your wallet.">
        <div className="space-y-4">
          <Tabs
            id="library"
            label="Library sections"
            items={[
              { to: '/library?tab=history', label: 'History', active: tab === 'history' },
              { to: '/library?tab=following', label: 'Following', active: tab === 'following' },
            ]}
          />
          {tab === 'history' ? <History /> : <Following />}
        </div>
      </RequireAuth>
    </div>
  )
}
