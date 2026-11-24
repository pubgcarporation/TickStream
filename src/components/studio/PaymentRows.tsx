import { HandCoins, Timer } from 'lucide-react'
import type { PaymentRecord } from '@shared/types'
import { UsdcMark } from '@/components/wallet/ActivityList'
import { formatMicro, shortAddress, timeAgo } from '@/lib/format'
import { addressLink } from '@/lib/arc'

const STATUS = {
  settled: { label: 'Settled', className: 'bg-[var(--success)]/15 text-[var(--success)]' },
  pending: { label: 'Batching', className: 'bg-[var(--warn)]/15 text-[var(--warn)]' },
  failed: { label: 'Failed', className: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
} as const

/** Payments as dense rows: logo, what it was for, who paid, status, amount. */
export function PaymentRows({ payments, empty = 'No payments yet.' }: { payments: PaymentRecord[]; empty?: string }) {
  if (payments.length === 0) return <p className="px-3.5 py-8 text-center text-[13px] text-[var(--muted)]">{empty}</p>
  return (
    <ul className="divide-y divide-[var(--border)]">
      {payments.map((payment) => {
        const status = STATUS[payment.status]
        const tip = payment.kind === 'tip'
        return (
          <li key={payment.id} className="flex items-center gap-3 px-3.5 py-2 text-[13px]">
            <UsdcMark incoming size={32} badge={tip ? <HandCoins className="size-3" strokeWidth={3} aria-hidden /> : <Timer className="size-3" strokeWidth={3} aria-hidden />} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate font-medium">
                <span className="truncate">{payment.videoTitle}</span>
                {tip && <span className="shrink-0 rounded bg-[var(--accent)]/15 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">Tip</span>}
              </p>
              <p className="truncate text-[11px] text-[var(--subtle)]">
                <a href={addressLink(payment.payer)} target="_blank" rel="noopener noreferrer" className="mono hover:text-[var(--ink)]">
                  {shortAddress(payment.payer)}
                </a>{' '}
                &bull; {tip ? 'tip' : `${payment.seconds}s`} &bull; {timeAgo(payment.createdAt)}
                {payment.message ? ` \u2022 "${payment.message}"` : ''}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>{status.label}</span>
            <span className="w-[5.5rem] shrink-0 text-right font-semibold tabular-nums text-[var(--success)]">+{formatMicro(payment.amountMicro)}</span>
          </li>
        )
      })}
    </ul>
  )
}
