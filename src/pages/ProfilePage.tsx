import type { UserProfile, VideoSummary } from '@shared/types'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { shortAddress } from '@/lib/format'

export function ProfilePage({ username }: { username: string }) {
  const { data, loading, error } = useApi<{ user: UserProfile; videos: VideoSummary[] }>(`users/${encodeURIComponent(username)}`)
  if (loading && !data) return <Skeleton className="h-64" />
  if (!data) return <EmptyState title="Creator not found" body={error?.message} />
  const { user, videos } = data
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5">
        <div className="display flex size-20 items-center justify-center rounded-3xl bg-[var(--accent)] text-3xl font-bold text-[var(--accent-ink)]" aria-hidden>
          {(user.displayName ?? user.username).slice(0, 1).toUpperCase()}
        </div>
        <div>
          <h1 className="display text-3xl font-bold">{user.displayName ?? user.username}</h1>
          <p className="mono mt-1 text-xs text-[var(--subtle)]">
            @{user.username} · {shortAddress(user.address)}
          </p>
          {user.bio && <p className="mt-3 max-w-xl text-pretty text-sm text-[var(--muted)]">{user.bio}</p>}
        </div>
      </div>
      {videos.length === 0 ? <EmptyState title="No videos yet" body="This creator has not published anything." /> : <VideoGrid videos={videos} />}
    </div>
  )
}
