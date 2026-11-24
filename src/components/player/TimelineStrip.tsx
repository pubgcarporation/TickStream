import { formatDuration } from '@/lib/format'
import type { PlaybackView } from './usePaidPlayback'

/**
 * Where the viewer is, how far ahead they have paid, and which part was free. Every mark comes from the live
 * session, so the strip is a true picture of what has been bought.
 */
export function TimelineStrip({ view }: { view: PlaybackView }) {
  const session = view.session
  if (!session || session.durationSeconds <= 0) return null
  const total = session.durationSeconds
  const pct = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / total) * 100))}%`
  const paidFrom = session.startSecond
  const paidTo = session.authorizedEndSecond
  const played = Math.min(Math.max(view.position, paidFrom), paidTo)
  return (
    <div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={`Played to ${formatDuration(view.position)}, paid through ${formatDuration(paidTo)} of ${formatDuration(total)}`}
      >
        <div className="absolute inset-y-0 rounded-full bg-[var(--accent)]/30" style={{ left: pct(paidFrom), width: pct(paidTo - paidFrom) }} />
        <div className="absolute inset-y-0 rounded-full bg-[var(--accent)]" style={{ left: pct(paidFrom), width: pct(played - paidFrom) }} />
        {view.freeSeconds > 0 && <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--success)]/80" style={{ width: pct(view.freeSeconds) }} />}
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-[var(--subtle)]">
        <span>{formatDuration(Math.floor(view.position))} played</span>
        <span aria-hidden>·</span>
        <span>paid through {formatDuration(Math.floor(paidTo))}</span>
        {view.freeSeconds > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="text-[var(--success)]">first {formatDuration(view.freeSeconds)} free</span>
          </>
        )}
        <span className="ml-auto">{formatDuration(total)}</span>
      </p>
    </div>
  )
}
