import { Pause, Play, Square } from 'lucide-react'
import { Button, Panel } from '@/components/ui/primitives'
import { formatDuration, formatMicro } from '@/lib/format'
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
  const cost = Math.round(priceMicro * view.playedSeconds)
  const prepaid = Math.max(0, session.spentMicro - cost)
  const capUsed = Math.min(1, session.spentMicro / session.capMicro)
  const live = view.phase === 'playing' && !view.paused

  return (
    <Panel className="space-y-5">
      <div>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">Cost so far</span>
          <span className="flex items-center gap-1.5 text-xs text-[var(--subtle)]">
            <span className={`size-1.5 rounded-full ${live ? 'bg-[var(--success)]' : 'bg-[var(--subtle)]'}`} aria-hidden />
            {live ? 'Metering' : view.phase === 'playing' ? 'Paused, not charging' : 'Stopped'}
          </span>
        </div>
        <p className="display mt-2 text-5xl font-bold tabular-nums">
          {formatMicro(cost)}
          <span className="ml-2 text-lg font-medium text-[var(--subtle)]">USDC</span>
        </p>
        <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
          {formatDuration(view.playedSeconds)} watched at ${formatMicro(priceMicro)} per second
        </p>
      </div>

      <dl className="glass-inner divide-y divide-[var(--border)] rounded-2xl text-sm">
        <div className="flex justify-between px-4 py-3">
          <dt className="text-[var(--muted)]">Paid ahead</dt>
          <dd className="tabular-nums">{formatMicro(prepaid)}</dd>
        </div>
        <div className="flex justify-between px-4 py-3">
          <dt className="text-[var(--muted)]">Paid in total</dt>
          <dd className="tabular-nums">{formatMicro(session.spentMicro)}</dd>
        </div>
        <div className="px-4 py-3">
          <div className="flex justify-between">
            <dt className="text-[var(--muted)]">Your cap</dt>
            <dd className="tabular-nums">{formatMicro(session.capMicro)}</dd>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(capUsed * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Cap used">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${capUsed * 100}%`, transition: 'width 0.4s' }} />
          </div>
        </div>
      </dl>

      {view.phase === 'needs-funds' && (
        <div className="space-y-3 rounded-2xl bg-[var(--warn)]/10 p-4 text-sm">
          <p className="text-pretty text-[var(--warn)]">{view.message}</p>
          <div className="flex gap-2">
            <Button onClick={onAddFunds} className="flex-1">
              Add money
            </Button>
            <Button variant="secondary" onClick={onResume}>
              Retry
            </Button>
          </div>
        </div>
      )}
      {view.phase === 'capped' && (
        <div className="space-y-3 rounded-2xl bg-[var(--warn)]/10 p-4 text-sm">
          <p className="text-pretty text-[var(--warn)]">{view.message}</p>
          <div className="flex flex-wrap gap-2">
            {CAP_STEPS.filter((step) => step > session.capMicro && (availableMicro === null || BigInt(step) <= availableMicro)).map((step) => (
              <Button key={step} variant="secondary" onClick={() => onRaiseCap(step)} className="min-h-10 px-4">
                Raise to {formatMicro(step)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {(view.phase === 'ended' || view.phase === 'error') && view.message && (
        <div className="space-y-3">
          <p className={`text-pretty rounded-2xl p-4 text-sm ${view.phase === 'error' ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-white/5 text-[var(--muted)]'}`}>
            {view.message}
          </p>
          <Button full onClick={onEnd}>
            Watch again
          </Button>
        </div>
      )}

      {view.phase === 'playing' && (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onToggle} className="flex-1">
            {view.paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
            {view.paused ? 'Play' : 'Pause'}
          </Button>
          <Button variant="ghost" onClick={onEnd}>
            <Square className="size-4" aria-hidden /> End
          </Button>
        </div>
      )}
    </Panel>
  )
}
