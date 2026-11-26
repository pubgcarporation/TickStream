import { HandCoins, Share2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAccount } from 'wagmi'
import { toast } from 'sonner'
import { CATEGORIES, PAY_BLOCK_SECONDS } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { CommentsSection } from '@/components/community/CommentsSection'
import { FollowButton, useFollowState } from '@/components/community/FollowButton'
import { CostMeter } from '@/components/player/CostMeter'
import { PlayerSurface } from '@/components/player/PlayerSurface'
import { StartPanel } from '@/components/player/StartPanel'
import { usePaidPlayback } from '@/components/player/usePaidPlayback'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { RelatedVideos } from '@/components/video/RelatedVideos'
import { TipSheet } from '@/components/video/TipSheet'
import { VideoDescription } from '@/components/video/VideoDescription'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { useApi } from '@/hooks/useApi'
import { useShareLink } from '@/hooks/useShareLink'
import { compactNumber, creatorLabel } from '@/lib/format'
import { Link } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

// The server accepts a session limit of up to 100 USDC. The viewer's spending balance is the real limit.
const MAX_SESSION_MICRO = 100_000_000n
const WIDE = '(min-width: 1280px)'

function useWide(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(WIDE)
      query.addEventListener('change', notify)
      return () => query.removeEventListener('change', notify)
    },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}

export function WatchPage({ videoId }: { videoId: string }) {
  const { address } = useAccount()
  const { balance, spender, unlock } = useSpendingWallet()
  const { data, error, loading } = useApi<{ video: VideoSummary; error: string | null }>(`videos/${videoId}`)
  const { user } = useAuth()
  const progress = useApi<{ second: number }>(user ? `videos/${videoId}/progress` : null)
  const playback = usePaidPlayback(videoId, address)
  const follow = useFollowState(data?.video.creator.username ?? null)
  const [depositOpen, setDepositOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const shareUrl = useShareLink(`/watch/${videoId}`)
  const wide = useWide()

  const video = data?.video
  const phase = playback.view.phase
  // After a session ends, ask the server where the viewer stopped, so "Resume at" is never out of date.
  const reloadProgress = progress.reload
  const wasActive = useRef(false)
  useEffect(() => {
    if (phase === 'playing') wasActive.current = true
    else if ((phase === 'idle' || phase === 'ended') && wasActive.current) {
      wasActive.current = false
      reloadProgress()
    }
  }, [phase, reloadProgress])
  const lastSecond = progress.data?.second ?? 0
  const resumeAt = video?.durationSeconds && lastSecond >= 10 && lastSecond < video.durationSeconds - 10 ? lastSecond : 0
  const { view } = playback
  const idle = view.phase === 'idle' || view.phase === 'starting' || !view.session

  // A session can spend at most what the viewer has in their spending balance.
  const available = balance?.available ?? 0n
  const capMicro = Number(available > MAX_SESSION_MICRO ? MAX_SESSION_MICRO : available)

  const start = (startSecond = 0, cap = capMicro) => {
    // The key must be unlocked before the first payment. The wallet may ask for a free signature once.
    void unlock()
      .then((payer) => playback.start({ capMicro: cap, startSecond }, payer))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not unlock your spending wallet'))
  }

  // The poster's play button starts right away only when nothing else is needed first.
  const canStartNow = Boolean(user && spender && balance && video && balance.available >= BigInt(video.priceMicro * PAY_BLOCK_SECONDS * 2))
  const showPayment = () => document.getElementById('payment')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (loading && !video) {
    return (
      <div className="-mt-4 grid gap-x-6 xl:grid-cols-[minmax(0,1fr)_402px]">
        <div className="space-y-3">
          <Skeleton className="aspect-video !rounded-xl max-sm:-mx-4 max-sm:!rounded-none" />
          <Skeleton className="h-6 w-2/3 !rounded-md" />
          <Skeleton className="h-10 w-full !rounded-lg" />
        </div>
        <Skeleton className="mt-3 hidden h-96 !rounded-xl xl:block" />
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
  const creatorName = creatorLabel(video.creator)
  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied')
  }

  const pill = 'inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-medium transition-colors hover:bg-white/15 disabled:opacity-50'
  const followers = follow.data?.followers

  // Laid out like a video site's phone page: the player pinned on top with one flat pay line under it, then the title,
  // channel row, action chips, the grey description card, comments, and the next videos.
  return (
    <div className="-mt-4 grid items-start gap-x-6 gap-y-2.5 sm:-mt-3 xl:grid-cols-[minmax(0,1fr)_402px]">
      <div className="contents xl:col-start-1 xl:row-start-1 xl:block xl:space-y-2.5">
        <div className={`order-1 -mx-4 sm:mx-0 xl:static ${idle ? '' : 'sticky top-14 z-30 bg-[var(--bg)] shadow-lg shadow-black/50 sm:static sm:shadow-none'}`}>
          <PlayerSurface
            className="max-sm:rounded-none"
            videoId={video.id}
            videoRef={playback.videoRef}
            view={view}
            durationSeconds={video.durationSeconds ?? 0}
            onToggle={playback.togglePlay}
            onSeek={(second) => void playback.seek(second)}
            onStart={canStartNow ? () => start() : showPayment}
            onAddFunds={() => setDepositOpen(true)}
            onRetry={() => (view.phase === 'capped' ? start(Math.floor(view.position)) : void playback.resume())}
          />
          {idle ? (
            <StartPanel
              priceMicro={video.priceMicro}
              durationSeconds={video.durationSeconds}
              previewSeconds={video.previewSeconds}
              resumeAt={resumeAt}
              onResumeAt={(second) => start(second)}
              onStart={() => start()}
              onAddFunds={() => setDepositOpen(true)}
              starting={view.phase === 'starting'}
              message={view.message}
            />
          ) : (
            <CostMeter
              view={view}
              priceMicro={video.priceMicro}
              onEnd={() => void playback.end()}
              onAddFunds={() => setDepositOpen(true)}
              onResume={() => void playback.resume()}
              onContinue={() => start(Math.floor(view.position))}
            />
          )}
        </div>
        <h1 className="order-3 text-balance text-[17px] font-semibold leading-6 sm:text-xl">{video.title}</h1>
        <div className="order-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none">
            <Link to={`/profile/${video.creator.username}`} aria-label={`${creatorName}'s channel`} className="shrink-0">
              <Avatar name={creatorName} size={40} username={video.creator.username} version={video.creator.avatarVersion} />
            </Link>
            <Link to={`/profile/${video.creator.username}`} className="min-w-0 flex-1 leading-tight sm:pr-3">
              <span className="block truncate text-[15px] font-semibold hover:underline">{creatorName}</span>
              {followers !== undefined && (
                <span className="block text-xs tabular-nums text-[var(--muted)]">
                  {compactNumber(followers)} {followers === 1 ? 'follower' : 'followers'}
                </span>
              )}
            </Link>
            <FollowButton username={video.creator.username} creatorAddress={video.creator.address} state={follow.data} onChanged={follow.reload} />
          </div>
          <div className="-mx-4 flex w-[calc(100%+2rem)] gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:px-0">
            {user?.address !== video.creator.address && (
              <button type="button" onClick={() => setTipOpen(true)} className={pill}>
                <HandCoins className="size-4" aria-hidden /> Tip
              </button>
            )}
            <button type="button" onClick={() => void copyLink()} disabled={!shareUrl} className={pill}>
              <Share2 className="size-4" aria-hidden /> Share
            </button>
          </div>
        </div>
        <div className="order-5">
          <VideoDescription views={video.views} createdAt={video.createdAt} category={category} description={video.description} />
        </div>
      </div>

      <aside className="hidden xl:sticky xl:top-20 xl:block xl:col-start-2 xl:row-span-2 xl:row-start-1" aria-label="Related videos">
        {wide && <RelatedVideos videoId={video.id} />}
      </aside>

      <div className="order-6 mt-1 xl:order-none xl:col-start-1 xl:row-start-2">
        {/* Keyed by viewer, so signing in or out reloads the list with the right remove buttons. */}
        <CommentsSection key={`${video.id}:${user?.address ?? ''}`} videoId={video.id} />
      </div>
      {!wide && (
        <div className="order-7 mt-1">
          <RelatedVideos videoId={video.id} />
        </div>
      )}
      <TipSheet open={tipOpen} onClose={() => setTipOpen(false)} videoId={video.id} creatorName={creatorName} onAddFunds={() => setDepositOpen(true)} />
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  )
}
