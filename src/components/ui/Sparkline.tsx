import { useId } from 'react'

/** A small trend line with a soft fill, drawn from real data points only. */
export function Sparkline({ data, label, height = 40 }: { data: number[]; label: string; height?: number }) {
  const id = useId()
  if (data.length < 2 || data.every((value) => value === 0)) {
    return <div className="h-10 rounded-lg border border-dashed border-[var(--border)]" role="img" aria-label={`${label}: no data yet`} />
  }
  const width = 120
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width
    const y = height - 4 - ((value - min) / range) * (height - 8)
    return [x, y] as const
  })
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full overflow-visible" role="img" aria-label={label} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {last && <circle cx={last[0]} cy={last[1]} r="2.5" fill="var(--accent)" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}
