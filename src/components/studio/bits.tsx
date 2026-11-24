import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatDuration, formatMicro } from '@/lib/format'

/** The change from the period before, like "+12%". With nothing before it, a first value reads as "New". */
export function Delta({ current, previous, className = '' }: { current: number; previous: number; className?: string }) {
  if (previous === 0 && current === 0) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-[11px] text-[var(--subtle)] ${className}`}>
        <Minus className="size-3" aria-hidden /> 0%
      </span>
    )
  }
  if (previous === 0) return <span className={`text-[11px] font-semibold text-[var(--success)] ${className}`}>New</span>
  const percent = Math.round(((current - previous) / previous) * 100)
  const up = percent > 0
  const flat = percent === 0
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums ${flat ? 'text-[var(--subtle)]' : up ? 'text-[var(--success)]' : 'text-[var(--danger)]'} ${className}`}
      title="Compared with the period before"
    >
      <Icon className="size-3" aria-hidden /> {up ? '+' : ''}
      {percent}%
    </span>
  )
}

export const usdc = (micro: number) => formatMicro(micro)
export const watchTime = (seconds: number) => (seconds < 60 ? `${Math.round(seconds)}s` : formatDuration(seconds))

/** A thin bar for a share from 0 to 100. */
export function MiniBar({ percent, className = '' }: { percent: number; className?: string }) {
  return (
    <span className={`block h-1.5 overflow-hidden rounded-full bg-white/10 ${className}`} aria-hidden>
      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </span>
  )
}

/** Four segments that add up to the whole: how many paid sessions covered under 25%, 25 to 50, 50 to 75 and 75% or more. */
export function RetentionBar({ completion }: { completion: [number, number, number, number] }) {
  const total = completion.reduce((sum, value) => sum + value, 0)
  const shades = ['bg-[var(--danger)]/70', 'bg-[var(--warn)]/70', 'bg-[var(--info)]/70', 'bg-[var(--success)]']
  const labels = ['Under 25%', '25 to 50%', '50 to 75%', '75% or more']
  if (total === 0) return <span className="text-[var(--subtle)]">No paid sessions</span>
  return (
    <span className="flex h-1.5 w-28 overflow-hidden rounded-full bg-white/10" role="img" aria-label={labels.map((label, i) => `${label}: ${completion[i]} sessions`).join(', ')}>
      {completion.map((value, index) => (
        <span key={labels[index]} className={shades[index]} style={{ width: `${(value / total) * 100}%` }} title={`${labels[index]}: ${value}`} />
      ))}
    </span>
  )
}
