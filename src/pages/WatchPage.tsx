import { Link2 } from 'lucide-react'
import { useState } from 'react'
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
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { RelatedVideos } from '@/components/video/RelatedVideos'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { useApi } from '@/hooks/useApi'
import { useShareLink } from '@/hooks/useShareLink'
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
        <Skeleton className="aspect-video rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl" />
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
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
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
        <div>
          <h1 className="display text-balance text-3xl font-bold">{video.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--muted)]">
            <Link to={`/profile/${video.creator.username}`} className="font-semibold text-[var(--ink)] hover:underline">
              {video.creator.displayName ?? video.creator.username}
            </Link>
            <span aria-hidden>·</span>
            <span>{category}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{video.views} views</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <FollowButton username={video.creator.username} creatorAddress={video.creator.address} />
              <Button variant="ghost" onClick={() => void copyLink()} disabled={!shareUrl} className="min-h-10 px-3">
                <Link2 className="size-4" aria-hidden /> Copy link
              </Button>
            </div>
          </div>
          {video.description && <p className="mt-4 max-w-2xl text-pretty text-[var(--muted)]">{video.description}</p>}
        </div>
        <CommentsSection videoId={video.id} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24" aria-label="Payment">
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
