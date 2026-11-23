import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import type { EarningsSummary, PaymentRecord } from '@shared/types'
import { Button, EmptyState, Panel, Skeleton } from '@/components/ui/primitives'
import { WithdrawEarningsSheet } from '@/components/wallet/WithdrawEarningsSheet'
import { useGatewayBalanceOf } from '@/hooks/useGatewayBalanceOf'
import { StatCard } from '@/components/creator/EarningsChart'
import { useApi } from '@/hooks/useApi'
import { addressLink } from '@/lib/arc'
import { formatDuration, formatMicro } from '@/lib/format'
import { PaymentList } from './StudioOverview'

export function StudioEarnings() {
  const { address } = useAccount()
  const earnings = useApi<{ summary: EarningsSummary }>('creator/earnings')
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments')
  const { balance: gatewayBalance, reload: reloadBalance } = useGatewayBalanceOf(address)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const summary = earnings.data?.summary

  if (earnings.loading && !summary) return <Skeleton className="h-96" />
  if (!summary) return <EmptyState title="Could not load earnings" body={earnings.error?.message} />

  return (
    <div className="space-y-5">
      <div className="grid gap-x-8 gap-y-5 border-b border-[var(--border)] pb-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={formatMicro(summary.totalMicro)} unit="USDC" />
        <StatCard label="Settled onchain" value={formatMicro(summary.settledMicro)} unit="USDC" />
        <StatCard label="Batching" value={formatMicro(summary.pendingMicro)} unit="USDC" hint="Accepted, settling in the next batch" />
        <StatCard label="Time sold" value={formatDuration(summary.secondsSold)} />
      </div>

      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Your payout balance</h2>
          <p className="mt-1 max-w-xl text-pretty text-sm text-[var(--muted)]">
            Viewer payments are credited to your wallet address in Circle Gateway. This is the amount available to withdraw.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold tabular-nums">
            {gatewayBalance === null ? '...' : formatMicro(gatewayBalance.available)}
            <span className="ml-1.5 text-sm font-medium text-[var(--subtle)]">USDC</span>
          </p>
          <Button onClick={() => setWithdrawOpen(true)} disabled={!gatewayBalance || gatewayBalance.available === 0n} className="mt-3 min-h-10">
            Withdraw
          </Button>
          {address && (
            <a href={addressLink(address)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
              Your address on the explorer <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </Panel>

      <WithdrawEarningsSheet
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        available={gatewayBalance?.available ?? 0n}
        onDone={reloadBalance}
      />

      <Panel>
        <h2 className="mb-2 text-base font-semibold">By video</h2>
        {summary.perVideo.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No videos yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--subtle)]">
                  <th className="pb-2 font-medium">Video</th>
                  <th className="pb-2 text-right font-medium">Views</th>
                  <th className="pb-2 text-right font-medium">Time sold</th>
                  <th className="pb-2 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] tabular-nums">
                {summary.perVideo.map((video) => (
                  <tr key={video.videoId}>
                    <td className="max-w-[16rem] truncate py-2.5 font-medium">{video.title}</td>
                    <td className="py-2.5 text-right text-[var(--muted)]">{video.views}</td>
                    <td className="py-2.5 text-right text-[var(--muted)]">{formatDuration(video.secondsSold)}</td>
                    <td className="py-2.5 text-right font-semibold">{formatMicro(video.earnedMicro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-1 text-base font-semibold">Recent payments</h2>
        <PaymentList payments={payments.data?.payments ?? []} />
      </Panel>
    </div>
  )
}
