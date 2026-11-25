import { Clapperboard, ExternalLink, UserX } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { UserProfile, VideoSummary } from '@shared/types'
import { FollowButton, useFollowState } from '@/components/community/FollowButton'
import { Avatar } from '@/components/ui/Avatar'
import { Chip, EmptyState, ErrorState, Skeleton } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { ApiError } from '@/lib/api'
import { addressLink } from '@/lib/arc'
import { compactNumber, shortAddress } from '@/lib/format'

type Tab = 'videos' | 'about'
type Order = 'latest' | 'popular' | 'oldest'

const ORDERS: Array<{ key: Order; label: string }> = [
  { key: 'latest', label: 'Latest' },
  { key: 'popular', label: 'Popular' },
  { key: 'oldest', label: 'Oldest' },
]

/** A calm banner colour that stays the same for the same channel, since there is no banner picture to upload. */
function bannerFor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return `linear-gradient(115deg, hsl(${hash} 38% 22%), hsl(${(hash + 50) % 360} 42% 14%))`
}

function Header({ user, videos, onAbout }: { user: UserProfile; videos: VideoSummary[]; onAbout: () => void }) {
  const follow = useFollowState(user.username)
  const name = user.displayName ?? user.username
  const followers = follow.data?.followers
  return (
    <header className="flex items-start gap-4 sm:gap-6">
      <Avatar name={name} size={80} accent username={user.username} version={user.avatarVersion} className="sm:!size-[128px] sm:!text-[54px]" />
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className="display truncate text-2xl font-bold leading-8 sm:text-4xl sm:leading-10">{name}</h1>
        <p className="text-[13px] leading-5 text-[var(--muted)] sm:text-sm">
          <span className="font-medium text-[var(--ink)]">@{user.username}</span>
          <span aria-hidden> &bull; </span>
          <span className="tabular-nums">
            {followers === undefined ? '' : `${compactNumber(followers)} ${followers === 1 ? 'follower' : 'followers'}`}
            {followers === undefined ? '' : <span aria-hidden> &bull; </span>}
            {videos.length} {videos.length === 1 ? 'video' : 'videos'}
          </span>
        </p>
        {user.bio && (
          <button type="button" onClick={onAbout} className="line-clamp-1 max-w-2xl text-left text-[13px] text-[var(--muted)] hover:text-[var(--ink)] sm:text-sm">
            {user.bio} <span className="font-medium text-[var(--ink)]">...more</span>
          </button>
        )}
        <div className="pt-1.5">
          <FollowButton username={user.username} creatorAddress={user.address} state={follow.data} onChanged={follow.reload} />
        </div>
      </div>
    </header>
  )
}

function About({ user, videos }: { user: UserProfile; videos: VideoSummary[] }) {
  const joined = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const views = videos.reduce((sum, video) => sum + video.views, 0)
  return (
    <div className="max-w-2xl space-y-4 py-2 text-sm">
      <div>
        <h2 className="mb-1 text-base font-bold">Description</h2>
        <p className="whitespace-pre-wrap text-pretty text-[var(--ink-2)]">{user.bio || 'This channel has no description yet.'}</p>
      </div>
      <dl className="space-y-1.5 border-t border-[var(--border)] pt-3 tabular-nums">
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-[var(--muted)]">Joined</dt>
          <dd>{joined}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-[var(--muted)]">Videos</dt>
          <dd>{videos.length}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-[var(--muted)]">Views</dt>
          <dd>{compactNumber(views)}</dd>
        </div>
        <div className="flex gap-3">
          <dt className="w-24 shrink-0 text-[var(--muted)]">Wallet</dt>
          <dd>
            <a href={addressLink(user.address)} target="_blank" rel="noopener noreferrer" className="mono inline-flex items-center gap-1 hover:underline">
              {shortAddress(user.address)} <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function ProfilePage({ username }: { username: string }) {
  const { data, loading, error, reload } = useApi<{ user: UserProfile; videos: VideoSummary[] }>(`users/${encodeURIComponent(username)}`)
  const [tab, setTab] = useState<Tab>('videos')
  const [order, setOrder] = useState<Order>('latest')
  const videos = data?.videos
  const sorted = useMemo(() => {
    const list = [...(videos ?? [])]
    const time = (video: VideoSummary) => Date.parse(video.createdAt)
    if (order === 'popular') return list.sort((a, b) => b.views - a.views || time(b) - time(a))
    if (order === 'oldest') return list.sort((a, b) => time(a) - time(b))
    return list.sort((a, b) => time(b) - time(a))
  }, [videos, order])

  if (loading && !data) return <Skeleton className="h-64" />
  if (!data) {
    // A 404 means there is no such creator. Anything else (a dropped connection) can be retried.
    return error instanceof ApiError && error.status !== 404 ? (
      <ErrorState title="Could not load this profile" message={error.message} onRetry={reload} />
    ) : (
      <EmptyState icon={UserX} title="Creator not found" body="There is no creator with that name." />
    )
  }
  const { user } = data
  const name = user.displayName ?? user.username
  return (
    <div className="-mt-3 space-y-3">
      <div className="-mx-4 h-20 sm:mx-0 sm:h-36 sm:rounded-xl" style={{ background: bannerFor(name) }} aria-hidden />
      <Header user={user} videos={data.videos} onAbout={() => setTab('about')} />
      <div role="tablist" aria-label="Channel" className="flex gap-1 border-b border-[var(--border)]">
        {(['videos', 'about'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative min-h-10 px-4 text-sm font-medium capitalize transition-colors ${tab === key ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
          >
            {key}
            {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--ink)]" aria-hidden />}
          </button>
        ))}
      </div>
      {tab === 'about' ? (
        <About user={user} videos={data.videos} />
      ) : data.videos.length === 0 ? (
        <EmptyState icon={Clapperboard} title="No videos yet" body="This creator has not published anything." />
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2" role="group" aria-label="Sort videos">
            {ORDERS.map((item) => (
              <Chip key={item.key} size="sm" active={order === item.key} onClick={() => setOrder(item.key)}>
                {item.label}
              </Chip>
            ))}
          </div>
          <VideoGrid videos={sorted} dense hideCreator />
        </div>
      )}
    </div>
  )
}
