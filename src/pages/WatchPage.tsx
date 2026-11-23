import { Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { CATEGORIES, DEFAULT_CHUNK_SECONDS } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { CommentsSection } from '@/components/community/CommentsSection'
import { FollowButton } from '@/components/community/FollowButton'
import { billedMicro } from '@/components/player/billing'
import { CostMeter } from '@/components/player/CostMeter'
import { PlayerSurface } from '@/components/player/PlayerSurface'
import { StartPanel } from '@/components/player/StartPanel'
import { usePaidPlayback } from '@/components/player/usePaidPlayback'
import { Avatar } from '@/components/ui/Avatar'
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { RelatedVideos } from '@/components/video/RelatedVideos'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { useApi } from '@/hooks/useApi'
import { useShareLink } from '@/hooks/useShareLink'
import { compactNumber, timeAgo } from '@/lib/format'
import { setActivePlayback } from '@/lib/playback-store'
import { Link } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

const DEFAULT_CAP = 1_000_000

export function WatchPage({ videoId }: { videoId: string }) {
  const { address } = useAccount()
  const { spender, balance } = useSpendingWallet()
  const { data, error, loading } = useApi<{ video: VideoSummary; error: string | null }>(`videos/${videoId}`)
  const { user } = useAuth()
  const progress = useApi<{ second: number }>(user ? `videos/${videoId}/progress` : null)
  const playback = usePaidPlayback(videoId, address)
  const [capChoice, setCapChoice] = useState(DEFAULT_CAP)
  const [chunkSeconds, setChunkSeconds] = useState<number>(DEFAULT_CHUNK_SECONDS)
  const [depositOpen, setDepositOpen] = useState(false)
  const shareUrl = useShareLink(`/watch/${videoId}`)

  const video = data?.video
  const phase = playback.view.phase
  const price = video?.priceMicro
  // The header shows this video's rate while it plays.
  useEffect(() => {
    if (phase === 'playing' && price !== undefined) setActivePlayback({ videoId, priceMicro: price })
    else setActivePlayback(null)
    return () => setActivePlayback(null)
  }, [phase, price, videoId])
  const lastSecond = progress.data?.second ?? 0
  const resumeAt = video?.durationSeconds && lastSecond >= 10 && lastSecond < video.durationSeconds - 10 ? lastSecond : 0
  const { view } = playback
  const idle = view.phase === 'idle' || view.phase === 'starting' || !view.session

  // Never pick a cap the viewer cannot cover.
  const available = balance?.available ?? 0n
  const capMicro = BigInt(capChoice) <= available ? capChoice : Math.max(Number(available > 5_000_000n ? 5_000_000n : available), 0)

  const start = (startSecond = 0, cap = capMicro) => {
    if (!spender) return
    void playback.start({ capMicro: cap, chunkSeconds, startSecond }, spender)
  }

  if (loading && !video) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Skeleton className="aspect-video rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (!video) {
    return (
      <EmptyState
        title="Video not found"
        body={error?.message ?? 'It may have been removed or is still processing.'}
        action={
          <Link to="/explore" className="text-sm font-semibold text-[var(--accent)]">
            Browse videos
          </Link>
        }
      />
    )
  }

  const category = CATEGORIES.find((c) => c.slug === video.category)?.label ?? 'Other'
  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied')
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-5">
        <PlayerSurface
          videoId={video.id}
          videoRef={playback.videoRef}
          view={view}
          viewer={address}
          durationSeconds={video.durationSeconds ?? 0}
          costMicro={billedMicro(view, video.priceMicro)}
          onToggle={playback.togglePlay}
          onSeek={(second) => void playback.seek(second)}
        />
        <div className="space-y-4">
          <h1 className="text-balance text-xl font-bold leading-snug sm:text-2xl">{video.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Link to={`/profile/${video.creator.username}`} aria-label={`${video.creator.displayName ?? video.creator.username}'s profile`}>
              <Avatar name={video.creator.displayName ?? video.creator.username} size={44} />
            </Link>
            <div className="min-w-0">
              <Link to={`/profile/${video.creator.username}`} className="block truncate font-semibold hover:underline">
                {video.creator.displayName ?? video.creator.username}
              </Link>
              <p className="text-xs text-[var(--subtle)]">{category}</p>
            </div>
            <FollowButton username={video.creator.username} creatorAddress={video.creator.address} />
            <Button variant="secondary" onClick={() => void copyLink()} disabled={!shareUrl} className="ml-auto min-h-10 rounded-full px-4">
              <Link2 className="size-4" aria-hidden /> Copy link
            </Button>
          </div>
          <div className="rounded-xl bg-[#181818] p-4 text-sm">
            <p className="font-semibold tabular-nums">
              {compactNumber(video.views)} views · {timeAgo(video.createdAt)}
            </p>
            {video.description && <p className="mt-2 max-w-3xl whitespace-pre-wrap text-pretty text-[var(--ink-2)]">{video.description}</p>}
          </div>
        </div>
        <CommentsSection videoId={video.id} />
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20" aria-label="Payment">
        {idle ? (
          <StartPanel
            priceMicro={video.priceMicro}
            durationSeconds={video.durationSeconds}
            previewSeconds={video.previewSeconds}
            resumeAt={resumeAt}
            onResumeAt={(second) => start(second)}
            chunkSeconds={chunkSeconds}
            capMicro={capMicro}
            onChunk={setChunkSeconds}
            onCap={setCapChoice}
            onStart={() => start()}
            onAddFunds={() => setDepositOpen(true)}
            starting={view.phase === 'starting'}
            message={view.message}
          />
        ) : (
          <CostMeter
            view={view}
            priceMicro={video.priceMicro}
            availableMicro={balance ? balance.available : null}
            onToggle={playback.togglePlay}
            onEnd={() => void playback.end()}
            onAddFunds={() => setDepositOpen(true)}
            onResume={() => void playback.resume()}
            onRaiseCap={(cap) => start(Math.floor(view.position), cap)}
          />
        )}
        <RelatedVideos videoId={video.id} />
      </aside>
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  )
}
