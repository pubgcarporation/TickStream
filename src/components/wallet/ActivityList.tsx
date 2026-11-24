import { TokenUSDC } from '@web3icons/react'
import { ArrowDownLeft, ArrowUpRight, ExternalLink } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/arcscan'
import { txLink } from '@/lib/arc'
import { formatMicro, shortAddress, timeAgo } from '@/lib/format'
import { Skeleton } from '@/components/ui/primitives'

const KINDS: Record<ActivityKind, { label: (counterparty: string) => string; incoming: boolean }> = {
  deposit: { label: () => 'Added to spending balance', incoming: false },
  withdrawal: { label: () => 'Moved back to your wallet', incoming: true },
  received: { label: (who) => `Received from ${shortAddress(who)}`, incoming: true },
  sent: { label: (who) => `Sent to ${shortAddress(who)}`, incoming: false },
}

/**
 * The USDC logo with a small coloured badge for the direction of the money: green and down for money in,
 * amber and up for money out. Used wherever a payment or transfer is listed.
 */
export function UsdcMark({ incoming, badge, size = 40 }: { incoming?: boolean; badge?: ReactNode; size?: number }) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <TokenUSDC variant="branded" size={size} aria-hidden />
      <span
        className={`absolute -bottom-0.5 -right-0.5 flex size-[18px] items-center justify-center rounded-full ring-2 ring-[var(--bg)] ${
          incoming ? 'bg-[var(--success)] text-[#04130a]' : 'bg-[var(--warn)] text-[#1f1600]'
        }`}
      >
        {badge ?? (incoming ? <ArrowDownLeft className="size-3" strokeWidth={3} aria-hidden /> : <ArrowUpRight className="size-3" strokeWidth={3} aria-hidden />)}
      </span>
    </span>
  )
}

/** Recent USDC movements for the connected wallet, as reported by the Arcscan explorer. */
export function ActivityList({ items, loading, error }: { items: ActivityItem[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="mt-3 space-y-3" aria-busy="true">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 !rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/3 !rounded-md" />
              <Skeleton className="h-3 w-1/4 !rounded-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--muted)]">
        {error ? 'Could not load your activity right now. It will retry on its own.' : 'No USDC movements yet. Deposits and withdrawals will show up here.'}
      </p>
    )
  }
  return (
    <ul className="mt-2 divide-y divide-[var(--border)]">
      {items.map((item) => {
        const kind = KINDS[item.kind]
        return (
          <li key={`${item.hash}:${item.kind}:${item.amount}`}>
            <a
              href={txLink(item.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="group -mx-2 flex min-h-16 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04]"
            >
              <UsdcMark incoming={kind.incoming} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{kind.label(item.counterparty)}</span>
                <span className="block text-xs text-[var(--subtle)]">{item.timestamp ? timeAgo(item.timestamp) : 'Just now'}</span>
              </span>
              <span className={`text-right text-sm font-semibold tabular-nums ${kind.incoming ? 'text-[var(--success)]' : 'text-[var(--ink)]'}`}>
                {kind.incoming ? '+' : '\u2212'}
                {formatMicro(BigInt(item.amount))}
                <span className="ml-1 text-xs font-medium text-[var(--subtle)]">USDC</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-[var(--subtle)] opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-60" aria-hidden />
              <span className="sr-only">View transaction</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
