import { clsx } from 'clsx'
import { useState } from 'react'
import type { StudioDay, StudioStats, StudioTotals } from '@shared/types'
import { Segmented } from '@/components/ui/primitives'
import { Delta, usdc, watchTime } from './bits'
import { TrendChart } from './TrendChart'
import { RANGES, useStudioRange } from './useStudioStats'

export type MetricKey = 'earnings' | 'tips' | 'watch' | 'views' | 'viewers'

interface Metric {
  key: MetricKey
  label: string
  unit?: string
  total: (t: StudioTotals) => number
  day: (d: StudioDay) => number
  format: (v: number) => string
  hint: string
}

const METRICS: Metric[] = [
  {
    key: 'earnings',
    label: 'Earnings',
    unit: 'USDC',
    total: (t) => t.watchMicro + t.tipsMicro,
    day: (d) => d.watchMicro + d.tipsMicro,
    format: usdc,
    hint: 'Watch payments plus tips that Gateway accepted. Failed payments are not counted.',
  },
  {
    key: 'tips',
    label: 'Tips',
    unit: 'USDC',
    total: (t) => t.tipsMicro,
    day: (d) => d.tipsMicro,
    format: usdc,
    hint: 'Tips viewers sent you.',
  },
  {
    key: 'watch',
    label: 'Paid watch time',
    total: (t) => t.paidSeconds,
    day: (d) => d.paidSeconds,
    format: watchTime,
    hint: 'Seconds of video viewers paid for. The free preview is not included, and a few seconds paid ahead may not have been played.',
  },
  {
    key: 'views',
    label: 'Views',
    total: (t) => t.starts,
    day: (d) => d.starts,
    format: (v) => String(Math.round(v)),
    hint: 'Viewing sessions started, including ones that only used a free preview.',
  },
  {
    key: 'viewers',
    label: 'Paying viewers',
    total: (t) => t.payingViewers,
    day: (d) => d.payingViewers,
    format: (v) => String(Math.round(v)),
    hint: 'Different wallets that paid to watch. The total counts each wallet once for the whole period.',
  },
]

/** The range picker used by every Studio screen. */
export function RangePicker() {
  const [days, setDays] = useStudioRange()
  return (
    <div className="w-full sm:w-56">
      <Segmented label="Period" value={days} onChange={setDays} options={RANGES.map((range) => ({ value: range.days, label: range.label }))} />
    </div>
  )
}

/**
 * Metric cards that double as tabs, with the chart of the chosen one underneath. Compact on purpose: the number, the
 * change from the period before, and the daily shape, in one block.
 */
export function StatsExplorer({ stats, metrics = ['earnings', 'watch', 'views', 'viewers', 'tips'], initial }: { stats: StudioStats; metrics?: MetricKey[]; initial?: MetricKey }) {
  const shown = METRICS.filter((metric) => metrics.includes(metric.key))
  const [selected, setSelected] = useState<MetricKey>(initial ?? shown[0]?.key ?? 'earnings')
  const active = shown.find((metric) => metric.key === selected) ?? shown[0]
  if (!active) return null
  const points = stats.series.map((day) => ({ day: day.day, value: active.day(day) }))

  return (
    <section aria-label="Overview of the period" className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <div role="tablist" aria-label="Metric" className="grid grid-cols-2 border-b border-[var(--border)] sm:grid-cols-3 lg:grid-flow-col lg:auto-cols-fr">
        {shown.map((metric) => {
          const on = metric.key === active.key
          return (
            <button
              key={metric.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(metric.key)}
              title={metric.hint}
              className={clsx(
                'relative min-h-[76px] border-b-2 px-3.5 py-3 text-left transition-colors max-lg:border-r max-lg:border-[var(--border)] lg:border-r lg:border-[var(--border)] lg:last:border-r-0',
                on ? 'border-b-[var(--accent)] bg-white/[0.04]' : 'border-b-transparent hover:bg-white/[0.03]',
              )}
            >
              <span className="block text-[11px] font-medium text-[var(--subtle)]">{metric.label}</span>
              <span className="mt-0.5 flex items-baseline gap-1.5 tabular-nums">
                <span className="text-xl font-semibold leading-tight">{metric.format(metric.total(stats.current))}</span>
                {metric.unit && <span className="text-[11px] text-[var(--subtle)]">{metric.unit}</span>}
              </span>
              <Delta current={metric.total(stats.current)} previous={metric.total(stats.previous)} />
            </button>
          )
        })}
      </div>
      <div className="p-3.5 pt-4 sm:p-4 sm:pt-5">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-xs text-[var(--muted)]">
          <span>
            {active.label}, {stats.from} to {stats.to} <span className="text-[var(--subtle)]">(UTC days)</span>
          </span>
        </div>
        <TrendChart points={points} format={active.format} label={`${active.label} per day`} />
      </div>
    </section>
  )
}
