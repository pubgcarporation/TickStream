import type { EarningsSummary, PaymentRecord } from '@shared/types'
import { HandCoins, Timer } from 'lucide-react'
import { EarningsChart, StatCard } from '@/components/creator/EarningsChart'
import { UsdcMark } from '@/components/wallet/ActivityList'
import { ErrorState, Panel, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { formatDuration, formatMicro, shortAddress, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

const STATUS_STYLE = {
  settled: { label: 'Settled', className: 'bg-[var(--success)]/15 text-[var(--success)]' },
  pending: { label: 'Batching', className: 'bg-[var(--warn)]/15 text-[var(--warn)]' },
  failed: { label: 'Failed', className: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
} as const

export function PaymentList({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) return <p className="py-6 text-center text-sm text-[var(--muted)]">No payments yet.</p>
  return (
    <ul className="divide-y divide-[var(--border)]">
      {payments.map((payment) => {
        const status = STATUS_STYLE[payment.status]
        const tip = payment.kind === 'tip'
        return (
          <li key={payment.id} className="flex items-center gap-3 py-3 text-sm">
            <UsdcMark incoming size={36} badge={tip ? <HandCoins className="size-3" strokeWidth={3} aria-hidden /> : <Timer className="size-3" strokeWidth={3} aria-hidden />} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium">
                <span className="truncate">{payment.videoTitle}</span>
                {tip && <span className="shrink-0 rounded-md bg-[var(--accent)]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">Tip</span>}
              </p>
              <p className="mono text-xs text-[var(--subtle)]">
                {shortAddress(payment.payer)} · {tip ? 'tip' : `${payment.seconds}s`} · {timeAgo(payment.createdAt)}
              </p>
              {payment.message && <p className="mt-0.5 line-clamp-2 text-pretty text-xs text-[var(--muted)]">{payment.message}</p>}
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
            <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-[var(--success)]">+{formatMicro(payment.amountMicro)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function StudioOverview() {
  const earnings = useApi<{ summary: EarningsSummary }>('creator/earnings')
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments')
  const summary = earnings.data?.summary

  if (earnings.loading && !summary) return <Skeleton className="h-96" />
  if (!summary) return <ErrorState title="Could not load your studio" message={earnings.error?.message} onRetry={earnings.reload} />

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={formatMicro(summary.totalMicro)} unit="USDC" trend={summary.daily.map((day) => day.earnedMicro)} />
        <StatCard label="Last 24 hours" value={formatMicro(summary.last24hMicro)} unit="USDC" />
        <StatCard label="Time watched" value={formatDuration(summary.secondsSold)} hint="Seconds viewers paid for" trend={summary.daily.map((day) => day.secondsSold)} />
        <StatCard label="Still batching" value={formatMicro(summary.pendingMicro)} unit="USDC" hint="Accepted, waiting for onchain settlement" />
      </div>
      <Panel>
        <h2 className="mb-4 text-base font-semibold">Earnings, last 14 days</h2>
        <EarningsChart daily={summary.daily} />
      </Panel>
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-1 text-base font-semibold">Top videos</h2>
          {summary.perVideo.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Nothing uploaded yet. <Link to="/studio/upload" className="font-semibold text-[var(--accent)]">Upload your first video</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {summary.perVideo.slice(0, 5).map((video) => (
                <li key={video.videoId} className="flex items-center gap-3 py-2.5 text-sm">
                  <Link to={`/watch/${video.videoId}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                    {video.title}
                  </Link>
                  <span className="text-xs tabular-nums text-[var(--subtle)]">{video.views} views</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{formatMicro(video.earnedMicro)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="mb-1 text-base font-semibold">Recent payments</h2>
          <PaymentList payments={(payments.data?.payments ?? []).slice(0, 6)} />
        </Panel>
      </div>
    </div>
  )
}
