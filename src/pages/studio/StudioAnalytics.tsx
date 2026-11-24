import { ArrowDown, ArrowUp, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { StudioStats, StudioVideoStats } from '@shared/types'
import { Block, BlockEmpty } from '@/components/studio/Block'
import { RetentionBar, usdc, watchTime } from '@/components/studio/bits'
import { StatsExplorer } from '@/components/studio/StatsExplorer'
import { useStudioStats } from '@/components/studio/useStudioStats'
import { ErrorState, Skeleton } from '@/components/ui/primitives'
import { UsdcMark } from '@/components/wallet/ActivityList'
import { addressLink } from '@/lib/arc'
import { formatDuration, shortAddress } from '@/lib/format'
import { Link } from '@/lib/router'
import { VideoThumb } from './StudioOverview'

type SortKey = 'title' | 'starts' | 'payingViewers' | 'paidSeconds' | 'avgCompletionPercent' | 'earned'

const STATUS: Record<string, string> = { ready: 'Live', processing: 'Encoding', uploading: 'Waiting for file', failed: 'Failed' }

const earned = (video: StudioVideoStats) => video.watchMicro + video.tipsMicro
const valueOf = (video: StudioVideoStats, key: SortKey): number | string => (key === 'title' ? video.title : key === 'earned' ? earned(video) : video[key])

function Audience({ stats }: { stats: StudioStats }) {
  const { current, returningViewers } = stats
  const returningShare = current.payingViewers === 0 ? 0 : Math.round((returningViewers / current.payingViewers) * 100)
  const conversion = current.starts === 0 ? 0 : Math.round((current.paidSessions / current.starts) * 100)
  const perViewer = current.payingViewers === 0 ? 0 : Math.round((current.watchMicro + current.tipsMicro) / current.payingViewers)
  const perSession = current.paidSessions === 0 ? 0 : Math.round(current.paidSeconds / current.paidSessions)
  const items: Array<[string, string, string]> = [
    ['Returning viewers', `${returningViewers}`, current.payingViewers === 0 ? 'No paying viewers yet' : `${returningShare}% of paying viewers paid in 2 or more sessions`],
    ['Start to paid', `${conversion}%`, `${current.paidSessions} of ${current.starts} sessions paid for something`],
    ['Earned per paying viewer', usdc(perViewer), 'USDC, watch payments and tips'],
    ['Paid time per session', watchTime(perSession), 'Average, free preview not included'],
  ]
  return (
    <Block title="Audience">
      <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] lg:grid-cols-4 lg:divide-y-0">
        {items.map(([label, value, hint]) => (
          <div key={label} className="px-3.5 py-2">
            <dt className="text-[11px] font-medium text-[var(--subtle)]">{label}</dt>
            <dd className="text-lg font-semibold leading-6 tabular-nums">{value}</dd>
            <p className="text-pretty text-[11px] text-[var(--subtle)]">{hint}</p>
          </div>
        ))}
      </dl>
    </Block>
  )
}

function Head({ label, k, sort, dir, onSort, left }: { label: string; k: SortKey; sort: SortKey; dir: 'asc' | 'desc'; onSort: (k: SortKey) => void; left?: boolean }) {
  const on = sort === k
  return (
    <th scope="col" aria-sort={on ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={`px-3 py-1.5 font-medium ${left ? 'text-left' : 'text-right'}`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 text-[11px] font-medium hover:text-[var(--ink)] ${on ? 'text-[var(--ink)]' : 'text-[var(--subtle)]'}`}>
        {label}
        {on && (dir === 'asc' ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
      </button>
    </th>
  )
}

function VideosTable({ videos }: { videos: StudioVideoStats[] }) {
  const [sort, setSort] = useState<SortKey>('earned')
  const [dir, setDir] = useState<'asc' | 'desc'>('desc')
  const rows = useMemo(() => {
    const factor = dir === 'asc' ? 1 : -1
    return [...videos].sort((a, b) => {
      const x = valueOf(a, sort)
      const y = valueOf(b, sort)
      return (typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y)) * factor
    })
  }, [videos, sort, dir])
  const onSort = (key: SortKey) => {
    if (key === sort) setDir((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSort(key)
      setDir(key === 'title' ? 'asc' : 'desc')
    }
  }
  if (videos.length === 0) {
    return (
      <BlockEmpty>
        No videos yet. <Link to="/studio/upload" className="font-semibold text-[var(--accent)]">Upload one</Link> to see its numbers here.
      </BlockEmpty>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="border-b border-[var(--border)]">
          <tr>
            <Head label="Video" k="title" sort={sort} dir={dir} onSort={onSort} left />
            <Head label="Views" k="starts" sort={sort} dir={dir} onSort={onSort} />
            <Head label="Paying viewers" k="payingViewers" sort={sort} dir={dir} onSort={onSort} />
            <Head label="Paid time" k="paidSeconds" sort={sort} dir={dir} onSort={onSort} />
            <Head label="Share paid for" k="avgCompletionPercent" sort={sort} dir={dir} onSort={onSort} />
            <Head label="Earned (USDC)" k="earned" sort={sort} dir={dir} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)] tabular-nums">
          {rows.map((video) => (
            <tr key={video.videoId} className="hover:bg-white/[0.03]">
              <td className="max-w-[20rem] px-3 py-1.5">
                <div className="flex items-center gap-2.5">
                  <VideoThumb videoId={video.videoId} className="w-12" />
                  <div className="min-w-0">
                    {video.status === 'ready' ? (
                      <Link to={`/watch/${video.videoId}`} className="flex items-center gap-1 truncate font-medium hover:underline">
                        <span className="truncate">{video.title}</span> <ExternalLink className="size-3 shrink-0 text-[var(--subtle)]" aria-hidden />
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{video.title}</span>
                    )}
                    <span className="block text-[11px] text-[var(--subtle)]">
                      {STATUS[video.status] ?? video.status} &bull; {video.durationSeconds ? formatDuration(video.durationSeconds) : '--:--'} &bull; ${usdc(video.priceMicro)}/s
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-3 py-1.5 text-right">{video.starts}</td>
              <td className="px-3 py-1.5 text-right">{video.payingViewers}</td>
              <td className="px-3 py-1.5 text-right text-[var(--muted)]">{watchTime(video.paidSeconds)}</td>
              <td className="px-3 py-1.5">
                <div className="ml-auto flex w-32 items-center justify-end gap-2">
                  <RetentionBar completion={video.completion} />
                  <span className="w-8 text-right">{video.avgCompletionPercent}%</span>
                </div>
              </td>
              <td className="px-3 py-1.5 text-right font-semibold">{usdc(earned(video))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Supporters({ stats }: { stats: StudioStats }) {
  if (stats.supporters.length === 0) return <BlockEmpty>No payments in this period yet.</BlockEmpty>
  return (
    <ul className="divide-y divide-[var(--border)]">
      {stats.supporters.map((supporter, index) => (
        <li key={supporter.payer} className="flex items-center gap-3 px-3.5 py-1.5 text-[13px]">
          <span className="w-4 text-center text-[11px] tabular-nums text-[var(--subtle)]">{index + 1}</span>
          <UsdcMark incoming size={26} />
          <span className="min-w-0 flex-1">
            <a href={addressLink(supporter.payer)} target="_blank" rel="noopener noreferrer" className="mono block truncate hover:underline">
              {shortAddress(supporter.payer)}
            </a>
            <span className="block text-[11px] text-[var(--subtle)]">
              {supporter.payments} {supporter.payments === 1 ? 'payment' : 'payments'}
              {supporter.tipsMicro > 0 ? ` \u2022 ${usdc(supporter.tipsMicro)} in tips` : ''}
            </span>
          </span>
          <span className="font-semibold tabular-nums">{usdc(supporter.totalMicro)}</span>
        </li>
      ))}
    </ul>
  )
}

export function StudioAnalytics() {
  const { stats, loading, refreshing, error, reload } = useStudioStats()
  if (loading && !stats) return <Skeleton className="h-80" />
  if (!stats) return <ErrorState title="Could not load analytics" message={error?.message} onRetry={reload} />

  return (
    <div className="space-y-2.5">
      <StatsExplorer stats={stats} refreshing={refreshing} />
      <Audience stats={stats} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Block title="Videos">
          <VideosTable videos={stats.videos} />
        </Block>
        <Block title="Top supporters">
          <Supporters stats={stats} />
        </Block>
      </div>
      <p className="text-pretty px-1 text-[11px] leading-snug text-[var(--subtle)]">
        Counted from real payments and viewing sessions. Views are sessions started. Paid time is what viewers paid for, so it can include a few seconds paid ahead that were not played. Share paid for is the part of the video a paid session covered. Supporters are the wallets that paid you, shown by the spending address. Days are UTC.
      </p>
    </div>
  )
}
