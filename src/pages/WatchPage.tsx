import { HandCoins, Share2 } from 'lucide-react'
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
import { TipSheet } from '@/components/video/TipSheet'
import { VideoDescription } from '@/components/video/VideoDescription'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { useApi } from '@/hooks/useApi'
import { useShareLink } from '@/hooks/useShareLink'
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
  const [tipOpen, setTipOpen] = useState(false)
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
  const creatorName = video.creator.displayName ?? video.creator.username
  const copyLink = async () => {
    if (!shareUrl) return
    await navigator.clipboard.writeText(shareUrl)
    toast.success('Link copied')
  }

  // On phones every block is its own grid item so the payment panel can sit right under the title and the player can stay pinned.
  return (
    <div className="grid items-start gap-x-6 gap-y-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-y-5">
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
          />
        </div>
        <h1 className="order-2 text-balance text-lg font-semibold leading-snug sm:text-xl">{video.title}</h1>
        <div className="order-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          <Link to={`/profile/${video.creator.username}`} className="flex min-w-0 flex-1 items-center gap-3 sm:flex-none" aria-label={`${creatorName}'s profile`}>
            <Avatar name={creatorName} size={40} />
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

      <aside className="order-3 space-y-6 xl:sticky xl:top-20 xl:order-none xl:col-start-2 xl:row-span-2 xl:row-start-1" aria-label="Payment">
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

      <div className="order-6 xl:order-none xl:col-start-1 xl:row-start-2">
        <CommentsSection videoId={video.id} />
      </div>
      <TipSheet open={tipOpen} onClose={() => setTipOpen(false)} videoId={video.id} creatorName={creatorName} onAddFunds={() => setDepositOpen(true)} />
      <DepositSheet open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  )
}
