import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { dayLabel } from './bits'

export interface TrendPoint {
  day: string
  value: number
}

/** Up to this many days read better as bars than as a line. */
const BAR_LIMIT = 14

/** A "nice" top for the axis, so the gridlines sit on round numbers. Whole-number metrics get an even top so the middle line is a whole number too. */
function niceMax(value: number, whole: boolean): number {
  if (value <= 0) return whole ? 2 : 1
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  const top = step * power
  return whole && top % 2 !== 0 ? top + 1 : top
}

function fullDay(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * A chart drawn from the real daily numbers: bars for a short period, a line for a longer one. Hover, touch or use
 * the arrow keys to read one day. The days are UTC days, so a payment made late in the evening elsewhere can land on
 * the next day.
 */
export function TrendChart({
  points,
  format,
  label,
  whole = false,
  height = 132,
}: {
  points: TrendPoint[]
  format: (value: number) => string
  label: string
  /** True for counts (views, viewers), so the axis never shows fractions. */
  whole?: boolean
  height?: number
}) {
  const id = useId()
  const box = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const count = points.length
  const bars = count <= BAR_LIMIT
  const width = 640
  const pad = { top: 6, bottom: 2 }
  const max = niceMax(Math.max(...points.map((p) => p.value), 0), whole)
  const total = points.reduce((sum, p) => sum + p.value, 0)
  /** Where point i sits, from 0 to 1 across the chart. */
  const frac = (i: number) => (bars ? (i + 0.5) / Math.max(count, 1) : count <= 1 ? 0.5 : i / (count - 1))
  const yAt = (v: number) => pad.top + (1 - v / max) * (height - pad.top - pad.bottom)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(frac(i) * width).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ')
  const area = count > 0 ? `${line} L ${(frac(count - 1) * width).toFixed(1)} ${height} L ${(frac(0) * width).toFixed(1)} ${height} Z` : ''
  const ticks = [1, 0.5, 0]
  const labelIdx = count < 2 ? [0] : bars && count <= 8 ? points.map((_, i) => i) : [0, Math.floor((count - 1) / 3), Math.floor(((count - 1) * 2) / 3), count - 1]
  const barWidth = (width / Math.max(count, 1)) * 0.56

  const move = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || count === 0) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    setHover(bars ? Math.min(count - 1, Math.floor(ratio * count)) : Math.round(ratio * (count - 1)))
  }
  const onKey = (event: KeyboardEvent) => {
    if (count === 0) return
    if (event.key === 'ArrowRight') setHover((value) => Math.min(count - 1, (value ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setHover((value) => Math.max(0, (value ?? count) - 1))
    else if (event.key === 'Escape') setHover(null)
    else return
    event.preventDefault()
  }
  const active = hover !== null ? points[hover] : undefined
  const activeLeft = hover !== null ? frac(hover) * 100 : 0

  return (
    <figure className="select-none">
      <div className="flex">
        <div className="flex w-11 shrink-0 flex-col justify-between pr-1.5 text-right text-[10px] tabular-nums text-[var(--subtle)]" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t === 0 ? '0' : format(max * t)}
            </span>
          ))}
        </div>
        <div
          ref={box}
          className="relative min-w-0 flex-1 touch-pan-y rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
          style={{ height }}
          tabIndex={0}
          onPointerMove={(event) => move(event.clientX)}
          onPointerDown={(event) => move(event.clientX)}
          onPointerLeave={() => setHover(null)}
          onKeyDown={onKey}
          onBlur={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" role="img" aria-label={label}>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <line key={t} x1="0" x2={width} y1={yAt(max * t)} y2={yAt(max * t)} stroke="rgba(255,255,255,0.08)" strokeDasharray={t === 0 ? undefined : '3 4'} vectorEffect="non-scaling-stroke" />
            ))}
            {total > 0 && bars &&
              points.map((p, i) => {
                const top = yAt(p.value)
                return (
                  <rect
                    key={p.day}
                    x={frac(i) * width - barWidth / 2}
                    y={p.value > 0 ? Math.min(top, height - 2) : height - 1}
                    width={barWidth}
                    height={p.value > 0 ? Math.max(2, height - pad.bottom - top) : 1}
                    rx="2"
                    fill="var(--accent)"
                    opacity={hover === null || hover === i ? (p.value > 0 ? 0.9 : 0.25) : 0.4}
                  />
                )
              })}
            {total > 0 && !bars && (
              <>
                <path d={area} fill={`url(#${id})`} />
                <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {active && !bars && <line x1={frac(hover ?? 0) * width} x2={frac(hover ?? 0) * width} y1="0" y2={height} stroke="rgba(255,255,255,0.35)" vectorEffect="non-scaling-stroke" />}
          </svg>
          {total === 0 && <p className="absolute inset-0 flex items-center justify-center text-xs text-[var(--subtle)]">Nothing in this period yet.</p>}
          {active && hover !== null && total > 0 && (
            <>
              {!bars && (
                <span
                  className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]"
                  style={{ left: `${activeLeft}%`, top: `${(yAt(active.value) / height) * 100}%` }}
                />
              )}
              <span
                className="pointer-events-none absolute -top-1 z-10 whitespace-nowrap rounded-md border border-[var(--border)] bg-[#1c1c1c] px-2 py-1 text-[11px] tabular-nums shadow-lg"
                style={{ left: `${activeLeft}%`, transform: `translate(${activeLeft > 75 ? '-100%' : activeLeft < 25 ? '0%' : '-50%'}, -100%)` }}
              >
                <span className="text-[var(--subtle)]">{fullDay(active.day)}</span> <span className="font-semibold">{format(active.value)}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <figcaption className="relative ml-11 mt-1 h-3 text-[10px] tabular-nums text-[var(--subtle)]">
        {labelIdx.map((i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap"
            style={{ left: `${frac(i) * 100}%`, transform: `translateX(${frac(i) < 0.08 ? '0%' : frac(i) > 0.92 ? '-100%' : '-50%'})` }}
          >
            {points[i] ? dayLabel(points[i].day) : ''}
          </span>
        ))}
      </figcaption>
    </figure>
  )
}
