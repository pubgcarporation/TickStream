import { useMemo } from 'react'
import type { PaymentRecord, StudioStats, StudioVideoStats } from '@shared/types'
import { MiniBar, usdc, watchTime } from '@/components/studio/bits'
import { Block } from '@/components/studio/Block'
import { PaymentRows } from '@/components/studio/PaymentRows'
import { RangePicker, StatsExplorer } from '@/components/studio/StatsExplorer'
import { useStudioRange, useStudioStats } from '@/components/studio/useStudioStats'
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
      <p className="px-3.5 py-8 text-center text-[13px] text-[var(--muted)]">
        {videos.length === 0 ? (
          <>
            Nothing uploaded yet. <Link to="/studio/upload" className="font-semibold text-[var(--accent)]">Upload your first video</Link>.
          </>
        ) : (
          'No earnings from your videos in this period yet.'
        )}
      </p>
    )
  }
  return (
    <ul className="divide-y divide-[var(--border)]">
      {ranked.map((video) => {
        const earned = video.watchMicro + video.tipsMicro
        return (
          <li key={video.videoId}>
            <Link to={`/watch/${video.videoId}`} className="flex items-center gap-3 px-3.5 py-2 text-[13px] transition-colors hover:bg-white/[0.03]">
              <VideoThumb videoId={video.videoId} className="w-16" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{video.title}</span>
                <span className="mt-1 flex items-center gap-2">
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
    <Block title="Your videos" action={<Link to="/studio/videos" className="font-semibold text-[var(--accent)] hover:underline">Manage</Link>}>
      <dl className="grid grid-cols-3 divide-x divide-[var(--border)] text-center">
        {items.map(([label, value, color]) => (
          <div key={label} className="px-2 py-3">
            <dd className={`text-xl font-semibold tabular-nums ${value > 0 ? color : 'text-[var(--ink)]'}`}>{value}</dd>
            <dt className="text-[11px] text-[var(--subtle)]">{label}</dt>
          </div>
        ))}
      </dl>
    </Block>
  )
}

export function StudioOverview() {
  const [days] = useStudioRange()
  const { stats, loading, error, reload } = useStudioStats(days)
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments?limit=6')
  const latest = useMemo(() => payments.data?.payments ?? [], [payments.data])

  if (loading && !stats) return <Skeleton className="h-96" />
  if (!stats) return <ErrorState title="Could not load your studio" message={error?.message} onRetry={reload} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[var(--muted)]">
          Channel at a glance. Changes compare with the {stats.days} days before.
        </p>
        <RangePicker />
      </div>
      <StatsExplorer stats={stats} />
      <div className="grid gap-3 lg:grid-cols-2">
        <Block title="Top videos" action={<Link to="/studio/analytics" className="font-semibold text-[var(--accent)] hover:underline">All analytics</Link>}>
          <TopVideos videos={stats.videos} />
        </Block>
        <Block title="Latest payments" action={<Link to="/studio/earnings" className="font-semibold text-[var(--accent)] hover:underline">Earnings</Link>}>
          <PaymentRows payments={latest} />
        </Block>
      </div>
      <Status stats={stats} />
    </div>
  )
}
