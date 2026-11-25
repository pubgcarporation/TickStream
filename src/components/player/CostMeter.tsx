import { TokenUSDC } from '@web3icons/react'
import { Loader2 } from 'lucide-react'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { formatMicro } from '@/lib/format'
import { billedMicro } from './billing'
import type { PlaybackView } from './usePaidPlayback'

interface CostMeterProps {
  view: PlaybackView
  priceMicro: number
  onEnd: () => void
  onAddFunds: () => void
  onResume: () => void
  onContinue: () => void
}

const SMALL = 'h-8 shrink-0 rounded-full px-3 text-[13px] font-medium'

/** One flat line under the player: what has been watched, what is paid ahead, and a way to stop. */
export function CostMeter({ view, priceMicro, onEnd, onAddFunds, onResume, onContinue }: CostMeterProps) {
  const session = view.session
  if (!session) return null
  // The free preview is never billed, so only time past it counts toward the cost.
  const cost = billedMicro(view, priceMicro)
  const prepaid = Math.max(0, session.spentMicro - cost)
  const live = view.phase === 'playing' && !view.paused
  const capUsed = session.capMicro > 0 ? (session.spentMicro / session.capMicro) * 100 : 0

  return (
    <section id="payment" aria-label="Payment" className="scroll-mt-32 bg-[var(--bg)] px-4 py-1.5 sm:px-0">
      <div className="flex items-center gap-x-3 text-[13px] tabular-nums">
        <span className="live-dot shrink-0" data-idle={!live} aria-hidden />
        <p className="flex min-w-0 flex-1 flex-nowrap items-center gap-x-2 whitespace-nowrap" aria-live="off">
          <span className="flex shrink-0 items-center gap-1 font-semibold" title={`USDC for what you have watched${live ? '' : view.phase === 'playing' ? ' (paused)' : ''}`}>
            <TokenUSDC variant="branded" size={16} aria-hidden />
            <AnimatedAmount micro={cost} />
          </span>
          <span className="min-w-0 truncate text-[var(--subtle)]" title="Paid in advance for video you have not watched yet. Payments cannot be refunded.">
            {formatMicro(prepaid)} ahead
          </span>
          {view.paying && <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--accent)]" aria-label="Paying" />}
        </p>
        {view.phase === 'playing' && (
          <button type="button" onClick={onEnd} className={`${SMALL} bg-white/10 hover:bg-white/15`}>
            End
          </button>
        )}
      </div>

      {capUsed >= 80 && view.phase === 'playing' && (
        <p className="mt-0.5 text-[11px] tabular-nums text-[var(--warn)]">
          {formatMicro(session.spentMicro)} of {formatMicro(session.capMicro)} USDC session limit used
        </p>
      )}

      {(view.phase === 'needs-funds' || view.phase === 'capped') && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-pretty text-[13px] text-[var(--warn)]">{view.message}</p>
          <button type="button" onClick={onAddFunds} className={`${SMALL} bg-[#f1f1f1] text-[#0f0f0f] hover:bg-white`}>
            Add money
          </button>
          <button type="button" onClick={view.phase === 'capped' ? onContinue : onResume} className={`${SMALL} bg-white/10 hover:bg-white/15`}>
            {view.phase === 'capped' ? 'Continue' : 'Retry'}
          </button>
        </div>
      )}
      {(view.phase === 'ended' || view.phase === 'error') && view.message && (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className={`min-w-0 flex-1 text-pretty text-[13px] ${view.phase === 'error' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{view.message}</p>
          <button type="button" onClick={onEnd} className={`${SMALL} bg-[#f1f1f1] text-[#0f0f0f] hover:bg-white`}>
            Watch again
          </button>
        </div>
      )}
    </section>
  )
}
