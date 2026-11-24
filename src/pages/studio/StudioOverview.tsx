import { useMemo } from 'react'
import type { PaymentRecord, StudioStats, StudioVideoStats } from '@shared/types'
import { MiniBar, usdc, watchTime } from '@/components/studio/bits'
import { Block, BlockEmpty } from '@/components/studio/Block'
import { PaymentRows } from '@/components/studio/PaymentRows'
import { StatsExplorer } from '@/components/studio/StatsExplorer'
import { useStudioStats } from '@/components/studio/useStudioStats'
import { ErrorState, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { thumbnailUrl } from '@/lib/api'
import { Link } from '@/lib/router'

export function VideoThumb({ videoId, className = '' }: { videoId: string; className?: string }) {
  return (
    <span className={`block aspect-video shrink-0 overflow-hidden rounded bg-[#2a2a2a] ${className}`}>
      <img src={thumbnailUrl(videoId)} alt="" loading="lazy" className="size-full object-cover" onError={(event) => (event.currentTarget.style.display = 'none')} />
    </span>
  )
}

function TopVideos({ videos }: { videos: StudioVideoStats[] }) {
  const ranked = videos.filter((video) => video.watchMicro + video.tipsMicro > 0).slice(0, 5)
  const top = Math.max(1, ...ranked.map((video) => video.watchMicro + video.tipsMicro))
  if (ranked.length === 0) {
    return (
      <BlockEmpty>
        {videos.length === 0 ? (
          <>
            Nothing uploaded yet. <Link to="/studio/upload" className="font-semibold text-[var(--accent)]">Upload your first video</Link>.
          </>
        ) : (
          'No earnings from your videos in this period yet.'
        )}
      </BlockEmpty>
    )
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {ranked.map((video) => {
        const earned = video.watchMicro + video.tipsMicro
        return (
          <li key={video.videoId}>
            <Link to={`/watch/${video.videoId}`} className="flex items-center gap-3 px-3.5 py-1.5 text-[13px] transition-colors hover:bg-white/[0.03]">
              <VideoThumb videoId={video.videoId} className="w-14" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{video.title}</span>
                <span className="mt-0.5 flex items-center gap-2">
                  <MiniBar percent={(earned / top) * 100} className="w-24" />
                  <span className="text-[11px] tabular-nums text-[var(--subtle)]">{watchTime(video.paidSeconds)} paid</span>
                </span>
              </span>
              <span className="shrink-0 text-right font-semibold tabular-nums">{usdc(earned)}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function Status({ stats }: { stats: StudioStats }) {
  const count = (status: string) => stats.videos.filter((video) => video.status === status).length
  const items: Array<[string, number, string]> = [
    ['Live', count('ready'), 'text-[var(--success)]'],
    ['Encoding', count('processing') + count('uploading'), 'text-[var(--warn)]'],
    ['Failed', count('failed'), 'text-[var(--danger)]'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-[13px]">
      <span className="font-semibold">Your videos</span>
      <dl className="flex items-center gap-4">
        {items.map(([label, value, color]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dd className={`font-semibold tabular-nums ${value > 0 ? color : 'text-[var(--ink)]'}`}>{value}</dd>
            <dt className="text-[11px] text-[var(--subtle)]">{label}</dt>
          </div>
        ))}
      </dl>
      <Link to="/studio/videos" className="ml-auto text-xs font-semibold text-[var(--accent)] hover:underline">
        Manage
      </Link>
    </div>
  )
}

export function StudioOverview() {
  const { stats, loading, refreshing, error, reload } = useStudioStats()
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments?limit=6')
  const latest = useMemo(() => payments.data?.payments ?? [], [payments.data])

  if (loading && !stats) return <Skeleton className="h-80" />
  if (!stats) return <ErrorState title="Could not load your studio" message={error?.message} onRetry={reload} />

  return (
    <div className="space-y-2.5">
      <StatsExplorer stats={stats} refreshing={refreshing} />
      <div className="grid gap-2.5 lg:grid-cols-2">
        <Block title="Top videos" action={<Link to="/studio/analytics" className="font-semibold text-[var(--accent)] hover:underline">All analytics</Link>}>
          <TopVideos videos={stats.videos} />
        </Block>
        <Block title="Latest payments" action={<Link to="/studio/earnings" className="font-semibold text-[var(--accent)] hover:underline">Earnings</Link>}>
          {payments.error && !payments.data ? (
            <BlockEmpty>
              Could not load payments.{' '}
              <button type="button" className="font-semibold text-[var(--accent)]" onClick={payments.reload}>
                Try again
              </button>
            </BlockEmpty>
          ) : (
            <PaymentRows payments={latest} />
          )}
        </Block>
      </div>
      <Status stats={stats} />
    </div>
  )
}
