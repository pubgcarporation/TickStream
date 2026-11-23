import { useState } from 'react'
import type { CreatorSummary, VideoSummary } from '@shared/types'
import { RequireAuth } from '@/components/creator/RequireAuth'
import { Chip, EmptyState, Skeleton } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { formatDuration, formatMicro, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

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

function History() {
  const { data, loading } = useApi<{ history: HistoryItem[] }>('me/history')
  if (loading && !data) return <Skeleton className="h-64" />
  if (!data || data.history.length === 0) {
    return (
      <EmptyState
        title="Nothing watched yet"
        body="Videos you pay to watch show up here with exactly what each one cost."
        action={
          <Link to="/explore" className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)]">
            Find something to watch
          </Link>
        }
      />
    )
  }
  const total = data.history.reduce((sum, item) => sum + item.spentMicro, 0)
  return (
    <div className="space-y-4">
      <p className="text-sm tabular-nums text-[var(--muted)]">
        {data.history.length} recent sessions, {formatMicro(total)} USDC in total.
      </p>
      <ul className="space-y-3">
        {data.history.map((item) => (
          <li key={item.id} className="glass flex items-center gap-4 rounded-3xl p-4">
            <div className="min-w-0 flex-1">
              <Link to={`/watch/${item.videoId}`} className="block truncate font-semibold hover:underline">
                {item.title}
              </Link>
              <p className="mt-1 text-xs tabular-nums text-[var(--subtle)]">
                {item.creator} · {formatDuration(item.seconds)} paid for · {timeAgo(item.startedAt)}
              </p>
            </div>
            {item.durationSeconds && item.positionSecond >= 10 && item.positionSecond < item.durationSeconds - 10 && (
              <Link to={`/watch/${item.videoId}`} className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15 sm:inline-block">
                Resume at {formatDuration(item.positionSecond)}
              </Link>
            )}
            <span className="font-semibold tabular-nums">
              {formatMicro(item.spentMicro)} <span className="text-xs font-medium text-[var(--subtle)]">USDC</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Following() {
  const creators = useApi<{ creators: CreatorSummary[] }>('me/following')
  const feed = useApi<{ videos: VideoSummary[] }>('me/feed')
  if (creators.loading && !creators.data) return <Skeleton className="h-64" />
  if (!creators.data || creators.data.creators.length === 0) {
    return (
      <EmptyState
        title="You are not following anyone"
        body="Follow creators from a video or profile page to see their new videos here."
        action={
          <Link to="/explore" className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)]">
            Explore creators
          </Link>
        }
      />
    )
  }
  return (
    <div className="space-y-8">
      <ul className="flex flex-wrap gap-2" aria-label="Creators you follow">
        {creators.data.creators.map((creator) => (
          <li key={creator.address}>
            <Link to={`/profile/${creator.username}`} className="glass-inner inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium hover:text-[var(--accent)]">
              {creator.displayName ?? creator.username}
              <span className="text-xs tabular-nums text-[var(--subtle)]">{creator.videos} videos</span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="latest" className="space-y-4">
        <h2 id="latest" className="display text-xl font-semibold">
          Latest from creators you follow
        </h2>
        {feed.data && feed.data.videos.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nothing new yet.</p>
        ) : (
          <VideoGrid videos={feed.data?.videos ?? null} loading={feed.loading && !feed.data} />
        )}
      </section>
    </div>
  )
}

export function LibraryPage() {
  const [tab, setTab] = useState<'history' | 'following'>('history')
  return (
    <div className="space-y-6">
      <h1 className="display text-4xl font-bold">Library</h1>
      <RequireAuth title="Sign in to see your library" body="Your watch history and the creators you follow are tied to your wallet.">
        <div className="space-y-6">
          <div className="flex gap-2" role="tablist" aria-label="Library sections">
            <Chip active={tab === 'history'} onClick={() => setTab('history')}>
              History
            </Chip>
            <Chip active={tab === 'following'} onClick={() => setTab('following')}>
              Following
            </Chip>
          </div>
          {tab === 'history' ? <History /> : <Following />}
        </div>
      </RequireAuth>
    </div>
  )
}
