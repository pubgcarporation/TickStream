import type { EarningsSummary } from '@shared/types'
import { Sparkline } from '@/components/ui/Sparkline'
import { formatMicro } from '@/lib/format'

export function StatCard({ label, value, unit, hint, trend }: { label: string; value: string; unit?: string; hint?: string; trend?: number[] }) {
  return (
    <div className="rise rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--subtle)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-1.5 text-sm font-medium text-[var(--subtle)]">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>}
      {trend && (
        <div className="mt-2">
          <Sparkline data={trend} label={`${label}, last 14 days`} />
        </div>
      )}
    </div>
  )
}

/** Daily earnings for the last two weeks, drawn from real payment records. */
export function EarningsChart({ daily }: { daily: EarningsSummary['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.earnedMicro))
  const total = daily.reduce((sum, d) => sum + d.earnedMicro, 0)
  if (total === 0) {
    return <p className="py-10 text-center text-sm text-[var(--muted)]">No earnings in the last 14 days yet.</p>
  }
  return (
    <figure>
      <div className="mb-1 flex justify-between text-[10px] tabular-nums text-[var(--subtle)]">
        <span>{formatMicro(max)} USDC peak day</span>
      </div>
      <div className="flex h-40 items-end gap-1.5 border-b border-[var(--border)]" role="img" aria-label="Earnings per day for the last 14 days">
        {daily.map((day) => (
          <div key={day.day} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-[var(--accent)]/70 transition-colors group-hover:bg-[var(--accent)]"
              style={{ height: `${Math.max(2, (day.earnedMicro / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute -top-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-[10px] tabular-nums group-hover:block">
              {day.day.slice(5)}: {formatMicro(day.earnedMicro)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[10px] tabular-nums text-[var(--subtle)]">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>{daily[daily.length - 1]?.day.slice(5)}</span>
      </figcaption>
    </figure>
  )
}
