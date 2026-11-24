import { ArrowDownLeft, ArrowUpRight, ExternalLink, PiggyBank, Wallet } from 'lucide-react'
import type { ComponentType } from 'react'
import type { ActivityItem, ActivityKind } from '@/lib/arcscan'
import { txLink } from '@/lib/arc'
import { formatMicro, shortAddress, timeAgo } from '@/lib/format'
import { Skeleton } from '@/components/ui/primitives'

const KINDS: Record<ActivityKind, { label: (counterparty: string) => string; sign: '+' | '-'; icon: ComponentType<{ className?: string }> }> = {
  deposit: { label: () => 'Added to spending balance', sign: '-', icon: PiggyBank },
  withdrawal: { label: () => 'Moved back to your wallet', sign: '+', icon: Wallet },
  received: { label: (who) => `Received from ${shortAddress(who)}`, sign: '+', icon: ArrowDownLeft },
  sent: { label: (who) => `Sent to ${shortAddress(who)}`, sign: '-', icon: ArrowUpRight },
}

/** Recent USDC movements for the connected wallet, as reported by the Arcscan explorer. */
export function ActivityList({ items, loading, error }: { items: ActivityItem[]; loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <div className="mt-3 space-y-2" aria-busy="true">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-12 w-full rounded-lg" />
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
    <ul className="mt-3 divide-y divide-[var(--border)]">
      {items.map((item) => {
        const kind = KINDS[item.kind]
        const Icon = kind.icon
        return (
          <li key={`${item.hash}:${item.kind}:${item.amount}`}>
            <a
              href={txLink(item.hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 items-center gap-3 py-2.5 hover:bg-white/5"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface)]">
                <Icon className="size-4 text-[var(--muted)]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{kind.label(item.counterparty)}</span>
                <span className="block text-xs text-[var(--subtle)]">{item.timestamp ? timeAgo(item.timestamp) : ''}</span>
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {kind.sign}
                {formatMicro(BigInt(item.amount))}
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
              <span className="sr-only">View transaction</span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}
