import { Download, ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import type { PaymentRecord } from '@shared/types'
import { Block } from '@/components/studio/Block'
import { usdc } from '@/components/studio/bits'
import { PaymentRows } from '@/components/studio/PaymentRows'
import { RangePicker, StatsExplorer } from '@/components/studio/StatsExplorer'
import { useStudioRange, useStudioStats } from '@/components/studio/useStudioStats'
import { Button, Chip, ErrorState, Skeleton } from '@/components/ui/primitives'
import { WithdrawEarningsSheet } from '@/components/wallet/WithdrawEarningsSheet'
import { useGatewayBalanceOf } from '@/hooks/useGatewayBalanceOf'
import { api } from '@/lib/api'
import { addressLink } from '@/lib/arc'
import { formatMicro } from '@/lib/format'

const PAGE = 50
type Filter = 'all' | 'watch' | 'tip' | 'pending' | 'failed'

const FILTERS: Array<{ key: Filter; label: string; test: (p: PaymentRecord) => boolean }> = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'watch', label: 'Watch', test: (p) => p.kind === 'watch' },
  { key: 'tip', label: 'Tips', test: (p) => p.kind === 'tip' },
  { key: 'pending', label: 'Batching', test: (p) => p.status === 'pending' },
  { key: 'failed', label: 'Failed', test: (p) => p.status === 'failed' },
]

function csvOf(payments: PaymentRecord[]): string {
  const cell = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const rows = payments.map((p) =>
    [p.createdAt, p.videoTitle, p.kind, p.status, p.seconds, formatMicro(p.amountMicro), p.payer, p.message].map(cell).join(','),
  )
  return ['Time (UTC),Video,Kind,Status,Seconds,Amount (USDC),Payer,Note', ...rows].join('\n')
}

function Settlement({ pending, settled }: { pending: number; settled: number }) {
  const total = pending + settled
  return (
    <Block title="Settlement in this period">
      <div className="space-y-2 px-3.5 py-3">
        <div className="flex h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Settled ${usdc(settled)}, batching ${usdc(pending)}`}>
          {total > 0 && (
            <>
              <span className="bg-[var(--success)]" style={{ width: `${(settled / total) * 100}%` }} />
              <span className="bg-[var(--warn)]" style={{ width: `${(pending / total) * 100}%` }} />
            </>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] tabular-nums">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--success)]" aria-hidden />
            <dt className="text-[var(--muted)]">Settled onchain</dt>
            <dd className="font-semibold">{usdc(settled)}</dd>
          </div>
          <div className="flex items-center gap-2" title="Accepted by Gateway, waiting for the next onchain batch. It is already yours.">
            <span className="size-2 rounded-full bg-[var(--warn)]" aria-hidden />
            <dt className="text-[var(--muted)]">Batching</dt>
            <dd className="font-semibold">{usdc(pending)}</dd>
          </div>
        </dl>
      </div>
    </Block>
  )
}

export function StudioEarnings() {
  const { address } = useAccount()
  const [days] = useStudioRange()
  const { stats, loading, error, reload } = useStudioStats(days)
  const { balance: gatewayBalance, reload: reloadBalance } = useGatewayBalanceOf(address)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [more, setMore] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  const loadPayments = async (offset: number) => {
    setLoadingPayments(true)
    try {
      const page = await api<{ payments: PaymentRecord[]; more: boolean }>(`creator/payments?limit=${PAGE}&offset=${offset}`)
      setPayments((current) => (offset === 0 ? page.payments : [...current, ...page.payments]))
      setMore(page.more)
      setPaymentsError(null)
    } catch (caught) {
      setPaymentsError(caught instanceof Error ? caught.message : 'Could not load payments')
    } finally {
      setLoadingPayments(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => void loadPayments(0), 0)
    return () => clearTimeout(timer)
  }, [])

  const visible = useMemo(() => {
    const test = FILTERS.find((item) => item.key === filter)?.test ?? (() => true)
    return payments.filter(test)
  }, [payments, filter])

  const exportCsv = () => {
    const blob = new Blob([csvOf(visible)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `tickstream-payments-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading && !stats) return <Skeleton className="h-96" />
  if (!stats) return <ErrorState title="Could not load earnings" message={error?.message} onRetry={reload} />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex min-w-[260px] flex-1 items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--subtle)]" title="Viewer payments are credited to your wallet address in Circle Gateway. This is what you can withdraw.">
              Payout balance
            </p>
            <p className="text-2xl font-semibold tabular-nums">
              {gatewayBalance === null ? '...' : formatMicro(gatewayBalance.available)}
              <span className="ml-1.5 text-xs font-medium text-[var(--subtle)]">USDC</span>
            </p>
            {address && (
              <a href={addressLink(address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
                Your address on the explorer <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
          <Button onClick={() => setWithdrawOpen(true)} disabled={!gatewayBalance || gatewayBalance.available === 0n} className="min-h-10 shrink-0">
            Withdraw
          </Button>
        </div>
        <div className="flex items-center">
          <RangePicker />
        </div>
      </div>

      <StatsExplorer stats={stats} metrics={['earnings', 'tips', 'watch']} />
      <Settlement pending={stats.settlement.pendingMicro} settled={stats.settlement.settledMicro} />

      <Block
        title="Payments"
        action={
          <button type="button" onClick={exportCsv} disabled={visible.length === 0} className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline disabled:opacity-40">
            <Download className="size-3.5" aria-hidden /> Export CSV
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-3.5 py-2" role="group" aria-label="Filter payments">
          {FILTERS.map((item) => (
            <Chip key={item.key} size="sm" active={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}
            </Chip>
          ))}
        </div>
        {paymentsError && payments.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[13px] text-[var(--muted)]">
            {paymentsError}{' '}
            <button type="button" className="font-semibold text-[var(--accent)]" onClick={() => void loadPayments(0)}>
              Try again
            </button>
          </p>
        ) : loadingPayments && payments.length === 0 ? (
          <Skeleton className="m-3 h-40" />
        ) : (
          <PaymentRows payments={visible} empty={filter === 'all' ? 'No payments yet.' : 'No payments match this filter in what is loaded.'} />
        )}
        {more && (
          <div className="border-t border-[var(--border)] p-2 text-center">
            <Button variant="ghost" loading={loadingPayments} onClick={() => void loadPayments(payments.length)}>
              Load older payments
            </Button>
          </div>
        )}
      </Block>

      <WithdrawEarningsSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} available={gatewayBalance?.available ?? 0n} onDone={reloadBalance} />
    </div>
  )
}
