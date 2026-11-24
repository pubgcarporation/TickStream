import { Clapperboard, UserX } from 'lucide-react'
import type { UserProfile, VideoSummary } from '@shared/types'
import { FollowButton } from '@/components/community/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { ApiError } from '@/lib/api'
import { shortAddress } from '@/lib/format'

export function ProfilePage({ username }: { username: string }) {
  const { data, loading, error, reload } = useApi<{ user: UserProfile; videos: VideoSummary[] }>(`users/${encodeURIComponent(username)}`)
  if (loading && !data) return <Skeleton className="h-64" />
  if (!data) {
    // A 404 means there is no such creator. Anything else (a dropped connection) can be retried.
    return error instanceof ApiError && error.status !== 404 ? (
      <ErrorState title="Could not load this profile" message={error.message} onRetry={reload} />
    ) : (
      <EmptyState icon={UserX} title="Creator not found" body="There is no creator with that name." />
    )
  }
  const { user, videos } = data
  const name = user.displayName ?? user.username
  return (
    <div className="space-y-6">
      {/* Sits as close under the header as the other pages' titles do. */}
      <section className="hero-card -mt-3 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <Avatar name={name} size={88} accent username={user.username} version={user.avatarVersion} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="display min-w-0 truncate text-2xl font-bold sm:text-3xl">{name}</h1>
            <FollowButton username={user.username} creatorAddress={user.address} />
          </div>
          <p className="mono mt-1 text-xs text-[var(--subtle)]">
            @{user.username} · {shortAddress(user.address)}
          </p>
          {user.bio && <p className="mt-2 max-w-xl text-pretty text-sm text-[var(--muted)]">{user.bio}</p>}
          <p className="mt-3 text-sm tabular-nums text-[var(--muted)]">
            <span className="font-semibold text-[var(--ink)]">{videos.length}</span> {videos.length === 1 ? 'video' : 'videos'}
          </p>
        </div>
      </section>
      {videos.length === 0 ? <EmptyState icon={Clapperboard} title="No videos yet" body="This creator has not published anything." /> : <VideoGrid videos={videos} />}
    </div>
  )
}
