import { ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import type { EarningsSummary, PaymentRecord } from '@shared/types'
import { EmptyState, Panel, Skeleton } from '@/components/ui/primitives'
import { StatCard } from '@/components/creator/EarningsChart'
import { useApi } from '@/hooks/useApi'
import { addressLink } from '@/lib/arc'
import { formatDuration, formatMicro } from '@/lib/format'
import { createGatewayClient } from '@/lib/spending-wallet'
import { PaymentList } from './StudioOverview'

function useCreatorGatewayBalance(address: string | undefined): bigint | null {
  const [balance, setBalance] = useState<bigint | null>(null)
  useEffect(() => {
    if (!address) return
    let cancelled = false
    createGatewayClient(address)
      .getBalances(address as `0x${string}`)
      .then((result) => {
        if (!cancelled) setBalance(result.gateway.total)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [address])
  return balance
}

export function StudioEarnings() {
  const { address } = useAccount()
  const earnings = useApi<{ summary: EarningsSummary }>('creator/earnings')
  const payments = useApi<{ payments: PaymentRecord[] }>('creator/payments')
  const gatewayBalance = useCreatorGatewayBalance(address)
  const summary = earnings.data?.summary

  if (earnings.loading && !summary) return <Skeleton className="h-96" />
  if (!summary) return <EmptyState title="Could not load earnings" body={earnings.error?.message} />

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total earned" value={formatMicro(summary.totalMicro)} unit="USDC" />
        <StatCard label="Settled onchain" value={formatMicro(summary.settledMicro)} unit="USDC" />
        <StatCard label="Batching" value={formatMicro(summary.pendingMicro)} unit="USDC" hint="Accepted, settling in the next batch" />
        <StatCard label="Time sold" value={formatDuration(summary.secondsSold)} />
      </div>

      <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="display text-xl font-semibold">Your payout balance</h2>
          <p className="mt-1 max-w-xl text-pretty text-sm text-[var(--muted)]">
            Viewer payments are credited to your wallet address in Circle Gateway. This is the amount Gateway currently holds for you.
          </p>
        </div>
        <div className="text-right">
          <p className="display text-3xl font-bold tabular-nums">
            {gatewayBalance === null ? '...' : formatMicro(gatewayBalance)}
            <span className="ml-1.5 text-sm font-medium text-[var(--subtle)]">USDC</span>
          </p>
          {address && (
            <a href={addressLink(address)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]">
              Your address on the explorer <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </Panel>

      <Panel>
        <h2 className="display mb-3 text-xl font-semibold">By video</h2>
        {summary.perVideo.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">No videos yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--subtle)]">
                  <th className="pb-3 font-semibold">Video</th>
                  <th className="pb-3 text-right font-semibold">Views</th>
                  <th className="pb-3 text-right font-semibold">Time sold</th>
                  <th className="pb-3 text-right font-semibold">Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)] tabular-nums">
                {summary.perVideo.map((video) => (
                  <tr key={video.videoId}>
                    <td className="max-w-[16rem] truncate py-3 font-medium">{video.title}</td>
                    <td className="py-3 text-right text-[var(--muted)]">{video.views}</td>
                    <td className="py-3 text-right text-[var(--muted)]">{formatDuration(video.secondsSold)}</td>
                    <td className="py-3 text-right font-semibold">{formatMicro(video.earnedMicro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel>
        <h2 className="display mb-3 text-xl font-semibold">Recent payments</h2>
        <PaymentList payments={payments.data?.payments ?? []} />
      </Panel>
    </div>
  )
}
