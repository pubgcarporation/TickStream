import { RequireAuth } from '@/components/creator/RequireAuth'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
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
  return (
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
          <span className="font-semibold tabular-nums">{formatMicro(item.spentMicro)} <span className="text-xs font-medium text-[var(--subtle)]">USDC</span></span>
        </li>
      ))}
    </ul>
  )
}

export function LibraryPage() {
  return (
    <div className="space-y-6">
      <h1 className="display text-4xl font-bold">Library</h1>
      <RequireAuth title="Sign in to see your history" body="Your watch history and what each video cost is tied to your wallet.">
        <History />
      </RequireAuth>
    </div>
  )
}
