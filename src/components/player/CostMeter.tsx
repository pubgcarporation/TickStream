import { Pause, Play, Square } from 'lucide-react'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Button, Card } from '@/components/ui/primitives'
import { formatDuration, formatMicro } from '@/lib/format'
import { billedMicro } from './billing'
import { TimelineStrip } from './TimelineStrip'
import type { PlaybackView } from './usePaidPlayback'

interface CostMeterProps {
  view: PlaybackView
  priceMicro: number
  onToggle: () => void
  onEnd: () => void
  onAddFunds: () => void
  onResume: () => void
  onRaiseCap: (capMicro: number) => void
  availableMicro: bigint | null
}

const CAP_STEPS = [250_000, 1_000_000, 5_000_000]

export function CostMeter({ view, priceMicro, onToggle, onEnd, onAddFunds, onResume, onRaiseCap, availableMicro }: CostMeterProps) {
  const session = view.session
  if (!session) return null
  // The free preview is never billed, so only time past it counts toward the cost.
  const cost = billedMicro(view, priceMicro)
  const prepaid = Math.max(0, session.spentMicro - cost)
  const capUsed = Math.min(1, session.spentMicro / session.capMicro)
  const live = view.phase === 'playing' && !view.paused
  const statusLabel = live ? 'Charging' : view.phase === 'playing' ? 'Paused' : view.phase === 'ended' ? 'Ended' : 'Stopped'

  return (
    <Card className="overflow-hidden">
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--subtle)]">Cost so far</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
              live ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-white/5 text-[var(--muted)]'
            }`}
          >
            <span className={`size-1.5 rounded-full ${live ? 'animate-pulse bg-[var(--success)]' : 'bg-[var(--subtle)]'}`} aria-hidden />
            {statusLabel}
          </span>
        </div>
        <p className="mt-2 text-4xl font-semibold tabular-nums">
          <AnimatedAmount micro={cost} />
          <span className="ml-2 text-base font-medium text-[var(--subtle)]">USDC</span>
        </p>
        <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
          {formatDuration(view.playedSeconds)} watched at ${formatMicro(priceMicro)} per second
        </p>
        <div className="mt-4">
          <TimelineStrip view={view} />
        </div>
      </div>

      <dl className="divide-y divide-[var(--border)] border-t border-[var(--border)] px-5 text-sm">
        <div className="flex justify-between py-2.5">
          <dt className="text-[var(--muted)]">Paid ahead</dt>
          <dd className="font-medium tabular-nums">{formatMicro(prepaid)}</dd>
        </div>
        <div className="flex justify-between py-2.5">
          <dt className="text-[var(--muted)]">Paid in total</dt>
          <dd className="font-medium tabular-nums">{formatMicro(session.spentMicro)}</dd>
        </div>
        <div className="py-2.5">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Spending limit</dt>
            <dd className="font-medium tabular-nums">{formatMicro(session.capMicro)}</dd>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
            role="progressbar"
            aria-valuenow={Math.round(capUsed * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Spending limit used"
          >
            <div
              className={`h-full rounded-full ${capUsed > 0.85 ? 'bg-[var(--warn)]' : 'bg-[var(--accent)]'}`}
              style={{ width: `${capUsed * 100}%`, transition: 'width 0.4s' }}
            />
          </div>
        </div>
      </dl>

      <div className="space-y-3 p-5 pt-4 empty:hidden">
        {view.phase === 'needs-funds' && (
          <>
            <p className="text-pretty rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-sm text-[var(--warn)]">{view.message}</p>
            <div className="flex gap-2">
              <Button shape="rect" onClick={onAddFunds} className="min-h-11 flex-1">
                Add money
              </Button>
              <Button shape="rect" variant="secondary" onClick={onResume} className="min-h-11">
                Retry
              </Button>
            </div>
          </>
        )}
        {view.phase === 'capped' && (
          <>
            <p className="text-pretty rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-sm text-[var(--warn)]">{view.message}</p>
            <div className="flex flex-wrap gap-2">
              {CAP_STEPS.filter((step) => step > session.capMicro && (availableMicro === null || BigInt(step) <= availableMicro)).map((step) => (
                <Button key={step} shape="rect" variant="secondary" onClick={() => onRaiseCap(step)} className="min-h-10 flex-1 px-4">
                  Raise to {formatMicro(step)}
                </Button>
              ))}
            </div>
          </>
        )}
        {(view.phase === 'ended' || view.phase === 'error') && view.message && (
          <>
            <p className={`text-pretty text-sm ${view.phase === 'error' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>{view.message}</p>
            <Button full shape="rect" onClick={onEnd} className="min-h-11">
              Watch again
            </Button>
          </>
        )}
        {view.phase === 'playing' && (
          <div className="grid grid-cols-2 gap-2">
            <Button shape="rect" variant="secondary" onClick={onToggle} className="min-h-11">
              {view.paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
              {view.paused ? 'Resume' : 'Pause'}
            </Button>
            <Button shape="rect" variant="secondary" onClick={onEnd} className="min-h-11">
              <Square className="size-4" aria-hidden /> End session
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
