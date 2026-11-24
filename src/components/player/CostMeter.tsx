import { Square } from 'lucide-react'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Button } from '@/components/ui/primitives'
import { formatMicro } from '@/lib/format'
import { billedMicro } from './billing'
import { TimelineStrip } from './TimelineStrip'
import type { PlaybackView } from './usePaidPlayback'

interface CostMeterProps {
  view: PlaybackView
  priceMicro: number
  onEnd: () => void
  onAddFunds: () => void
  onResume: () => void
  onContinue: () => void
}

export function CostMeter({ view, priceMicro, onEnd, onAddFunds, onResume, onContinue }: CostMeterProps) {
  const session = view.session
  if (!session) return null
  // The free preview is never billed, so only time past it counts toward the cost.
  const cost = billedMicro(view, priceMicro)
  const prepaid = Math.max(0, session.spentMicro - cost)
  const live = view.phase === 'playing' && !view.paused

  const capUsed = session.capMicro > 0 ? Math.min(100, (session.spentMicro / session.capMicro) * 100) : 0

  return (
    <section id="payment" aria-label="Payment" className="scroll-mt-32 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">
            <span className="live-dot" data-idle={!live} aria-hidden />
            {live ? 'Metering' : view.phase === 'playing' ? 'Paused' : 'Session'}
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">
            <AnimatedAmount micro={cost} />
            <span className="ml-1.5 text-sm font-medium text-[var(--subtle)]">USDC watched</span>
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs tabular-nums">
          <div title="Paid in advance for video you have not watched yet. Payments cannot be refunded.">
            <dt className="text-[var(--subtle)]">Paid ahead</dt>
            <dd className="text-sm font-medium">{formatMicro(prepaid)}</dd>
          </div>
          <div title="Everything Gateway has accepted this session. Payments are final.">
            <dt className="text-[var(--subtle)]">Paid in total</dt>
            <dd className="text-sm font-medium">{formatMicro(session.spentMicro)}</dd>
          </div>
        </dl>

        {view.phase === 'playing' && (
          <div className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
            <span className="text-xs text-[var(--muted)]" aria-live="polite">
              {view.paying ? 'Paying next step' : live ? 'Paid as it plays' : 'Paused, not charging'}
            </span>
            <Button shape="rect" variant="secondary" onClick={onEnd} className="min-h-10 flex-1 sm:flex-none">
              <Square className="size-4" aria-hidden /> End session
            </Button>
          </div>
        )}
      </div>

      <div className="mt-3" title="How much of this session's spending limit is used">
        <div className="meter-track" role="progressbar" aria-label="Session limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(capUsed)}>
          <div className="meter-fill" data-warn={capUsed >= 80} style={{ width: `${capUsed}%` }} />
        </div>
        <p className="mt-1 flex justify-between text-[11px] tabular-nums text-[var(--subtle)]">
          <span>{formatMicro(session.spentMicro)} of {formatMicro(session.capMicro)} USDC session limit</span>
          {capUsed >= 80 && <span className="text-[var(--warn)]">Nearly used up</span>}
        </p>
      </div>

      <div className="mt-3">
        <TimelineStrip view={view} />
      </div>

      {(view.phase === 'needs-funds' || view.phase === 'capped') && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="min-w-0 flex-1 text-pretty text-sm text-[var(--warn)]">{view.message}</p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button shape="rect" onClick={onAddFunds} className="min-h-10 flex-1 sm:flex-none">
              Add money
            </Button>
            <Button shape="rect" variant="secondary" onClick={view.phase === 'capped' ? onContinue : onResume} className="min-h-10 flex-1 sm:flex-none">
              {view.phase === 'capped' ? 'Continue' : 'Retry'}
            </Button>
          </div>
        </div>
      )}
      {(view.phase === 'ended' || view.phase === 'error') && view.message && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className={`min-w-0 flex-1 text-pretty text-sm ${view.phase === 'error' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{view.message}</p>
          <Button shape="rect" onClick={onEnd} className="min-h-10 w-full sm:w-auto">
            Watch again
          </Button>
        </div>
      )}
    </section>
  )
}
