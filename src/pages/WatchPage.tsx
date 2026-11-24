import { HandCoins, Share2 } from 'lucide-react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
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
import { TipSheet } from '@/components/video/TipSheet'
import { VideoDescription } from '@/components/video/VideoDescription'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { useApi } from '@/hooks/useApi'
import { useShareLink } from '@/hooks/useShareLink'
import { creatorLabel } from '@/lib/format'
import { setActivePlayback } from '@/lib/playback-store'
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
  const [chunkSeconds, setChunkSeconds] = useState<number>(DEFAULT_CHUNK_SECONDS)
  const [depositOpen, setDepositOpen] = useState(false)
  const [tipOpen, setTipOpen] = useState(false)
  const shareUrl = useShareLink(`/watch/${videoId}`)
  const wide = useWide()

  const video = data?.video
  const phase = playback.view.phase
  const price = video?.priceMicro
  // The header shows this video's rate while it plays.
  useEffect(() => {
    if (phase === 'playing' && price !== undefined) setActivePlayback({ videoId, priceMicro: price })
    else setActivePlayback(null)
    return () => setActivePlayback(null)
  }, [phase, price, videoId])
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
      .then((payer) => playback.start({ capMicro: cap, chunkSeconds, startSecond }, payer))
      .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not unlock your spending wallet'))
  }

  // The poster's play button starts right away only when nothing else is needed first.
  const canStartNow = Boolean(user && spender && balance && video && balance.available >= BigInt(video.priceMicro * chunkSeconds))
  const showPayment = () => document.getElementById('payment')?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if (loading && !video) {
    return (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <Skeleton className="aspect-video rounded-xl max-sm:-mx-4 max-sm:rounded-none" />
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-7 w-2/3 rounded-md" />
        </div>
        <Skeleton className="hidden h-96 rounded-xl xl:block" />
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

  // On phones every block is its own grid item so the payment panel can sit right under the title and the player can stay pinned.
  return (
    <div className="-mt-4 grid items-start gap-x-6 gap-y-4 sm:-mt-3 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-y-5">
      <div className="contents xl:col-start-1 xl:row-start-1 xl:block xl:space-y-4">
        <div className={`order-1 -mx-4 sm:mx-0 xl:static ${idle ? '' : 'sticky top-14 z-30 shadow-lg shadow-black/50 sm:static sm:shadow-none'}`}>
          <PlayerSurface
            className="max-sm:rounded-none"
            videoId={video.id}
            videoRef={playback.videoRef}
            view={view}
            viewer={address}
            durationSeconds={video.durationSeconds ?? 0}
            costMicro={billedMicro(view, video.priceMicro)}
            onToggle={playback.togglePlay}
            onSeek={(second) => void playback.seek(second)}
            onStart={canStartNow ? () => start() : showPayment}
            onAddFunds={() => setDepositOpen(true)}
            onRetry={() => (view.phase === 'capped' ? start(Math.floor(view.position)) : void playback.resume())}
          />
        </div>
        <div className="order-2">
        {idle ? (
          <StartPanel
            priceMicro={video.priceMicro}
            durationSeconds={video.durationSeconds}
            previewSeconds={video.previewSeconds}
            resumeAt={resumeAt}
            onResumeAt={(second) => start(second)}
            chunkSeconds={chunkSeconds}
            onChunk={setChunkSeconds}
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
        <h1 className="order-3 text-balance text-lg font-semibold leading-snug sm:text-xl">{video.title}</h1>
        <div className="order-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link to={`/profile/${video.creator.username}`} className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none" aria-label={`${creatorName}'s profile`}>
            <Avatar name={creatorName} size={40} username={video.creator.username} version={video.creator.avatarVersion} />
            <span className="min-w-0 truncate font-semibold hover:underline">{creatorName}</span>
          </Link>
          <FollowButton username={video.creator.username} creatorAddress={video.creator.address} />
          <div className="grid w-full auto-cols-fr grid-flow-col gap-2 sm:ml-auto sm:flex sm:w-auto">
            {user?.address !== video.creator.address && (
              <Button shape="rect" onClick={() => setTipOpen(true)} className="min-h-11 sm:min-h-10">
                <HandCoins className="size-4" aria-hidden /> Tip
              </Button>
            )}
            <Button variant="secondary" shape="rect" onClick={() => void copyLink()} disabled={!shareUrl} className="min-h-11 sm:min-h-10">
              <Share2 className="size-4" aria-hidden /> Share
            </Button>
          </div>
        </div>
        <div className="order-5">
          <VideoDescription views={video.views} createdAt={video.createdAt} category={category} description={video.description} />
        </div>
      </div>

      <aside className="hidden xl:sticky xl:top-20 xl:block xl:col-start-2 xl:row-span-2 xl:row-start-1" aria-label="Related videos">
        {wide && <RelatedVideos videoId={video.id} />}
      </aside>

      <div className="order-6 xl:order-none xl:col-start-1 xl:row-start-2">
        {/* Keyed by viewer, so signing in or out reloads the list with the right remove buttons. */}
        <CommentsSection key={`${video.id}:${user?.address ?? ''}`} videoId={video.id} />
      </div>
      {!wide && (
        <div className="order-7">
          <RelatedVideos videoId={video.id} />
        </div>
      )}
      <TipSheet open={tipOpen} onClose={() => setTipOpen(false)} videoId={video.id} creatorName={creatorName} onAddFunds={() => setDepositOpen(true)} />
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  )
}
