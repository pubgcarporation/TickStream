import type { EarningsSummary, PaymentRecord } from '@shared/types'
import { EarningsChart, StatCard } from '@/components/creator/EarningsChart'
import { EmptyState, Panel, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { formatDuration, formatMicro, shortAddress, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

export function PaymentList({ payments }: { payments: PaymentRecord[] }) {
  if (payments.length === 0) return <p className="py-6 text-center text-sm text-[var(--muted)]">No payments yet.</p>
  return (
    <ul className="divide-y divide-[var(--border)]">
      {payments.map((payment) => (
        <li key={payment.id} className="flex items-center gap-3 py-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{payment.videoTitle}</p>
            <p className="mono text-xs text-[var(--subtle)]">
              {shortAddress(payment.payer)} · {payment.seconds}s · {timeAgo(payment.createdAt)}
            </p>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              payment.status === 'settled'
                ? 'bg-[var(--success)]/15 text-[var(--success)]'
                : payment.status === 'failed'
                  ? 'bg-[var(--danger)]/15 text-[var(--danger)]'
                  : 'bg-white/10 text-[var(--muted)]'
            }`}
          >
            {payment.status === 'pending' ? 'Batching' : payment.status === 'settled' ? 'Settled' : 'Failed'}
          </span>
          <span className="w-24 text-right font-semibold tabular-nums">+{formatMicro(payment.amountMicro)}</span>
        </li>
      ))}
    </ul>
  )
}

export function StudioOverview() {
  const earnings = useApi<{ summary: EarningsSummary }>('creator/earnings')
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments')
  const summary = earnings.data?.summary

  if (earnings.loading && !summary) return <Skeleton className="h-96" />
  if (!summary) return <EmptyState title="Could not load your studio" body={earnings.error?.message} />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={formatMicro(summary.totalMicro)} unit="USDC" />
        <StatCard label="Last 24 hours" value={formatMicro(summary.last24hMicro)} unit="USDC" />
        <StatCard label="Time watched" value={formatDuration(summary.secondsSold)} hint="Seconds viewers paid for" />
        <StatCard label="Still batching" value={formatMicro(summary.pendingMicro)} unit="USDC" hint="Accepted, waiting for onchain settlement" />
      </div>
      <Panel>
        <h2 className="display mb-5 text-xl font-semibold">Earnings, last 14 days</h2>
        <EarningsChart daily={summary.daily} />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="display mb-3 text-xl font-semibold">Top videos</h2>
          {summary.perVideo.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              Nothing uploaded yet. <Link to="/studio/upload" className="font-semibold text-[var(--accent)]">Upload your first video</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {summary.perVideo.slice(0, 5).map((video) => (
                <li key={video.videoId} className="flex items-center gap-3 py-3 text-sm">
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
          <h2 className="display mb-3 text-xl font-semibold">Recent payments</h2>
          <PaymentList payments={(payments.data?.payments ?? []).slice(0, 6)} />
        </Panel>
      </div>
    </div>
  )
}
