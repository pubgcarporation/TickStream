import { useId, useRef, useState } from 'react'

export interface TrendPoint {
  day: string
  value: number
}

/** A "nice" top for the axis, so the gridlines sit on round numbers. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * power
}

function dayLabel(day: string): string {
  const date = new Date(`${day}T00:00:00Z`)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * A line chart drawn from the real daily numbers. Hover or touch to read one day. The days are UTC days, so a payment
 * made late in the evening elsewhere can land on the next day.
 */
export function TrendChart({
  points,
  format,
  label,
  height = 168,
}: {
  points: TrendPoint[]
  format: (value: number) => string
  label: string
  height?: number
}) {
  const id = useId()
  const box = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const width = 640
  const pad = { top: 8, bottom: 4 }
  const max = niceMax(Math.max(...points.map((p) => p.value), 0))
  const total = points.reduce((sum, p) => sum + p.value, 0)
  const xAt = (i: number) => (points.length <= 1 ? width / 2 : (i / (points.length - 1)) * width)
  const yAt = (v: number) => pad.top + (1 - v / max) * (height - pad.top - pad.bottom)
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L ${xAt(points.length - 1).toFixed(1)} ${height} L ${xAt(0).toFixed(1)} ${height} Z`
  const ticks = [1, 0.5, 0]
  const labelIdx = points.length < 2 ? [0] : [0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1]

  const move = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect || points.length === 0) return
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    setHover(Math.round(ratio * (points.length - 1)))
  }
  const active = hover !== null ? points[hover] : undefined

  return (
    <figure className="select-none">
      <div className="flex">
        <div className="relative flex w-12 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-[var(--subtle)]" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="leading-none">
              {t === 0 ? '0' : format(max * t)}
            </span>
          ))}
        </div>
        <div
          ref={box}
          className="relative min-w-0 flex-1 touch-pan-y"
          style={{ height }}
          onPointerMove={(event) => move(event.clientX)}
          onPointerDown={(event) => move(event.clientX)}
          onPointerLeave={() => setHover(null)}
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
            {total > 0 && (
              <>
                <path d={area} fill={`url(#${id})`} />
                <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </>
            )}
            {active && hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1="0" y2={height} stroke="rgba(255,255,255,0.35)" vectorEffect="non-scaling-stroke" />}
          </svg>
          {total === 0 && <p className="absolute inset-0 flex items-center justify-center text-xs text-[var(--subtle)]">Nothing in this period yet.</p>}
          {active && hover !== null && total > 0 && (
            <>
              <span
                className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] ring-2 ring-[var(--bg)]"
                style={{ left: `${(points.length <= 1 ? 0.5 : hover / (points.length - 1)) * 100}%`, top: `${(yAt(active.value) / height) * 100}%` }}
              />
              <span
                className="pointer-events-none absolute -top-1 z-10 -translate-y-full whitespace-nowrap rounded-md border border-[var(--border)] bg-[#1c1c1c] px-2 py-1 text-[11px] tabular-nums shadow-lg"
                style={{
                  left: `${(points.length <= 1 ? 0.5 : hover / (points.length - 1)) * 100}%`,
                  transform: `translate(${hover > points.length * 0.75 ? '-100%' : hover < points.length * 0.25 ? '0%' : '-50%'}, -100%)`,
                }}
              >
                <span className="text-[var(--subtle)]">{dayLabel(active.day)}</span> <span className="font-semibold">{format(active.value)}</span>
              </span>
            </>
          )}
        </div>
      </div>
      <figcaption className="ml-12 mt-1.5 flex justify-between text-[10px] tabular-nums text-[var(--subtle)]">
        {labelIdx.map((i) => (
          <span key={i}>{points[i] ? dayLabel(points[i].day) : ''}</span>
        ))}
      </figcaption>
    </figure>
  )
}
