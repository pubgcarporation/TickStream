import { clsx } from 'clsx'
import { Calendar, Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { rangeLabel } from './bits'
import {
  MAX_RANGE_DAYS,
  PRESETS,
  dayToMs,
  isValidRange,
  msToDay,
  resolveRange,
  spanDays,
  timeframeLabel,
  todayUtc,
  useTimeframe,
  type Timeframe,
} from './useStudioStats'

const dateField =
  'h-8 w-full min-w-0 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-[13px] tabular-nums text-[var(--ink)] outline-none [color-scheme:dark] focus:border-[var(--accent)]'

/**
 * The timeframe filter every Studio screen shares: quick periods, this and last month, or an exact range of days.
 * Days are UTC. The same choice is used on every screen and remembered.
 */
export function TimeframePicker({ className }: { className?: string }) {
  const [frame, setFrame] = useTimeframe()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const panelId = useId()
  const today = todayUtc()
  const current = resolveRange(frame)
  const [from, setFrom] = useState(current.from)
  const [to, setTo] = useState(current.to)

  const close = (refocus: boolean) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) {
      const range = resolveRange(frame)
      setFrom(range.from)
      setTo(range.to)
    }
    setOpen((value) => !value)
  }

  const choose = (next: Timeframe) => {
    setFrame(next)
    close(true)
  }

  const rangeOk = isValidRange(from, to)
  const rangeProblem = !from || !to ? 'Pick both days.' : from > to ? 'The first day must not be after the last.' : to > today ? 'The last day cannot be in the future.' : !rangeOk ? `A range can cover at most ${MAX_RANGE_DAYS} days.` : null
  const picked = rangeOk ? spanDays(from, to) : 0

  /** Quick custom ranges anchored on the chosen end day. */
  const shift = (days: number) => {
    const end = to && to <= today ? to : today
    setTo(end)
    setFrom(msToDay(dayToMs(end) - (days - 1) * 86_400_000))
  }

  const showsRange = frame.preset === 'custom'
  return (
    <div ref={root} className={clsx('relative', className)}>
      <button
        ref={trigger}
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[13px] font-medium transition-colors hover:bg-white/10"
      >
        <Calendar className="size-3.5 shrink-0 text-[var(--subtle)]" aria-hidden />
        <span className="truncate">{showsRange ? rangeLabel(current.from, current.to) : timeframeLabel(frame)}</span>
        {!showsRange && <span className="hidden truncate text-[11px] font-normal tabular-nums text-[var(--subtle)] xl:inline">{rangeLabel(current.from, current.to)}</span>}
        <ChevronDown className={clsx('size-3.5 shrink-0 text-[var(--subtle)] transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a timeframe"
          className="absolute right-0 top-full z-40 mt-1.5 w-[17.5rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-strong)] shadow-2xl"
        >
          <div role="radiogroup" aria-label="Timeframe" className="p-1">
            {PRESETS.map((preset) => {
              const on = frame.preset === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => choose({ preset: preset.key })}
                  className={clsx('flex min-h-8 w-full items-center justify-between gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors hover:bg-white/10', on && 'bg-white/[0.06] font-semibold')}
                >
                  {preset.label}
                  {on && <Check className="size-3.5 text-[var(--accent)]" aria-hidden />}
                </button>
              )
            })}
          </div>
          <form
            className="space-y-2 border-t border-[var(--border)] p-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              if (rangeOk) choose({ preset: 'custom', from, to })
            }}
          >
            <p className={clsx('text-[11px] font-semibold uppercase tracking-[0.08em]', frame.preset === 'custom' ? 'text-[var(--ink)]' : 'text-[var(--subtle)]')}>Custom range</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-[var(--subtle)]">
                From
                <input type="date" value={from} max={to || today} onChange={(event) => setFrom(event.target.value)} className={clsx(dateField, 'mt-0.5')} />
              </label>
              <label className="block text-[11px] text-[var(--subtle)]">
                To
                <input type="date" value={to} min={from || undefined} max={today} onChange={(event) => setTo(event.target.value)} className={clsx(dateField, 'mt-0.5')} />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[14, 30, 180].map((days) => (
                <button key={days} type="button" onClick={() => shift(days)} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:text-[var(--ink)]">
                  {days}d
                </button>
              ))}
              <span className="ml-auto text-[11px] tabular-nums text-[var(--subtle)]">{rangeOk ? `${picked} ${picked === 1 ? 'day' : 'days'}` : ''}</span>
            </div>
            {rangeProblem && <p className="text-[11px] text-[var(--danger)]">{rangeProblem}</p>}
            <button
              type="submit"
              disabled={!rangeOk}
              className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-[var(--accent)] text-[13px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply range
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
