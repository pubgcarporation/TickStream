import { Download, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAccount } from 'wagmi'
import type { PaymentRecord } from '@shared/types'
import { Block, BlockEmpty } from '@/components/studio/Block'
import { rangeLabel, usdc } from '@/components/studio/bits'
import { PaymentRows } from '@/components/studio/PaymentRows'
import { StatsExplorer } from '@/components/studio/StatsExplorer'
import { useStudioStats } from '@/components/studio/useStudioStats'
import { Button, Chip, ErrorState, Skeleton } from '@/components/ui/primitives'
import { WithdrawEarningsSheet } from '@/components/wallet/WithdrawEarningsSheet'
import { useGatewayBalanceOf } from '@/hooks/useGatewayBalanceOf'
import { api } from '@/lib/api'
import { addressLink } from '@/lib/arc'
import { formatMicro } from '@/lib/format'

const PAGE = 50
const EXPORT_PAGE = 100
const EXPORT_MAX_PAGES = 100
type Filter = 'all' | 'watch' | 'tip' | 'pending' | 'failed'
type PaymentPage = { payments: PaymentRecord[]; more: boolean }

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'watch', label: 'Watch' },
  { key: 'tip', label: 'Tips' },
  { key: 'pending', label: 'Batching' },
  { key: 'failed', label: 'Failed' },
]

/** A spreadsheet runs a cell that starts with = + - or @ as a formula, so text from other people is defused. */
function textCell(value: string | null): string {
  const text = String(value ?? '')
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

function csvOf(payments: PaymentRecord[]): string {
  const rows = payments.map((p) =>
    [textCell(p.createdAt), textCell(p.videoTitle), textCell(p.kind), textCell(p.status), String(p.seconds), formatMicro(p.amountMicro), textCell(p.payer), textCell(p.message)].join(','),
  )
  return ['Time (UTC),Video,Kind,Status,Seconds,Amount (USDC),Payer,Note', ...rows].join('\n')
}

function Settlement({ pending, settled }: { pending: number; settled: number }) {
  const total = pending + settled
  return (
    <div className="flex flex-col justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
      <p className="text-[11px] font-medium text-[var(--subtle)]">Settlement in this period</p>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Settled ${usdc(settled)}, batching ${usdc(pending)}`}>
        {total > 0 && (
          <>
            <span className="bg-[var(--success)]" style={{ width: `${(settled / total) * 100}%` }} />
            <span className="bg-[var(--warn)]" style={{ width: `${(pending / total) * 100}%` }} />
          </>
        )}
      </div>
      <dl className="flex flex-wrap gap-x-5 gap-y-0.5 text-[13px] tabular-nums">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[var(--success)]" aria-hidden />
          <dt className="text-[var(--muted)]">Settled onchain</dt>
          <dd className="font-semibold">{usdc(settled)}</dd>
        </div>
        <div className="flex items-center gap-1.5" title="Accepted by Gateway, waiting for the next onchain batch. It is already yours.">
          <span className="size-2 rounded-full bg-[var(--warn)]" aria-hidden />
          <dt className="text-[var(--muted)]">Batching</dt>
          <dd className="font-semibold">{usdc(pending)}</dd>
        </div>
      </dl>
    </div>
  )
}

export function StudioEarnings() {
  const { address } = useAccount()
  const { stats, loading, refreshing, error, reload } = useStudioStats()
  const { balance: gatewayBalance, reload: reloadBalance } = useGatewayBalanceOf(address)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [more, setMore] = useState(false)
  const [loadingPayments, setLoadingPayments] = useState(true)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const latest = useRef(0)
  const from = stats?.from
  const to = stats?.to

  // The list follows the timeframe and the filter. A slower answer for an older choice is ignored.
  const loadPayments = useCallback(
    async (offset: number) => {
      if (!from || !to) return
      const id = ++latest.current
      setLoadingPayments(true)
      try {
        const page = await api<PaymentPage>(`creator/payments?limit=${PAGE}&offset=${offset}&from=${from}&to=${to}&filter=${filter}`)
        if (id !== latest.current) return
        setPayments((current) => {
          if (offset === 0) return page.payments
          const seen = new Set(current.map((payment) => payment.id))
          return [...current, ...page.payments.filter((payment) => !seen.has(payment.id))]
        })
        setMore(page.more)
        setPaymentsError(null)
      } catch (caught) {
        if (id !== latest.current) return
        setPaymentsError(caught instanceof Error ? caught.message : 'Could not load payments')
      } finally {
        if (id === latest.current) setLoadingPayments(false)
      }
    },
    [from, to, filter],
  )

  useEffect(() => {
    const timer = setTimeout(() => void loadPayments(0), 0)
    return () => clearTimeout(timer)
  }, [loadPayments])

  /** Every payment in the period that matches the filter, not only the ones already on screen. */
  const exportCsv = async () => {
    if (!from || !to) return
    setExporting(true)
    try {
      const all: PaymentRecord[] = []
      for (let page = 0; page < EXPORT_MAX_PAGES; page += 1) {
        const result = await api<PaymentPage>(`creator/payments?limit=${EXPORT_PAGE}&offset=${page * EXPORT_PAGE}&from=${from}&to=${to}&filter=${filter}`)
        all.push(...result.payments)
        if (!result.more) break
      }
      const blob = new Blob([csvOf(all)], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tickstream-payments-${from}-to-${to}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${all.length} ${all.length === 1 ? 'payment' : 'payments'}`)
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not export')
    } finally {
      setExporting(false)
    }
  }

  if (loading && !stats) return <Skeleton className="h-80" />
  if (!stats) return <ErrorState title="Could not load earnings" message={error?.message} onRetry={reload} />

  return (
    <div className="space-y-2.5">
      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[var(--subtle)]" title="Viewer payments are credited to your wallet address in Circle Gateway. This is what you can withdraw.">
              Payout balance
            </p>
            <p className="text-xl font-semibold leading-7 tabular-nums">
              {gatewayBalance === null ? '...' : formatMicro(gatewayBalance.available)}
              <span className="ml-1.5 text-xs font-medium text-[var(--subtle)]">USDC</span>
            </p>
            {address && (
              <a href={addressLink(address)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
                Your address on the explorer <ExternalLink className="size-3" aria-hidden />
              </a>
            )}
          </div>
          <Button onClick={() => setWithdrawOpen(true)} disabled={!gatewayBalance || gatewayBalance.available === 0n} className="min-h-9 shrink-0">
            Withdraw
          </Button>
        </div>
        <Settlement pending={stats.settlement.pendingMicro} settled={stats.settlement.settledMicro} />
      </div>

      <StatsExplorer stats={stats} refreshing={refreshing} metrics={['earnings', 'tips', 'watch']} />

      <Block
        title={`Payments, ${rangeLabel(stats.from, stats.to)}`}
        action={
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting || (payments.length === 0 && !loadingPayments)}
            className="inline-flex items-center gap-1 font-semibold text-[var(--accent)] hover:underline disabled:opacity-40"
          >
            <Download className="size-3.5" aria-hidden /> {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-3.5 py-1.5" role="group" aria-label="Filter payments">
          {FILTERS.map((item) => (
            <Chip key={item.key} size="sm" active={filter === item.key} onClick={() => setFilter(item.key)}>
              {item.label}
            </Chip>
          ))}
        </div>
        {paymentsError && payments.length === 0 ? (
          <BlockEmpty>
            {paymentsError}{' '}
            <button type="button" className="font-semibold text-[var(--accent)]" onClick={() => void loadPayments(0)}>
              Try again
            </button>
          </BlockEmpty>
        ) : loadingPayments && payments.length === 0 ? (
          <Skeleton className="m-3 h-32" />
        ) : (
          <div className={loadingPayments ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            <PaymentRows payments={payments} empty={filter === 'all' ? 'No payments in this period.' : 'No payments match this filter in this period.'} />
          </div>
        )}
        {more && (
          <div className="border-t border-[var(--border)] p-1.5 text-center">
            <Button variant="ghost" className="min-h-9" loading={loadingPayments} onClick={() => void loadPayments(payments.length)}>
              Load older payments
            </Button>
          </div>
        )}
      </Block>

      <WithdrawEarningsSheet open={withdrawOpen} onClose={() => setWithdrawOpen(false)} available={gatewayBalance?.available ?? 0n} onDone={reloadBalance} />
    </div>
  )
}
