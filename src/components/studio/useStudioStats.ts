import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { StudioStats } from '@shared/types'
import { useApi } from '@/hooks/useApi'
import { safeStorage } from '@/lib/safe-storage'

export type PresetKey = 'today' | '7d' | '28d' | '90d' | '365d' | 'month' | 'lastMonth' | 'custom'

/** The period every Studio screen shows. Custom ranges carry their first and last day (YYYY-MM-DD, UTC). */
export interface Timeframe {
  preset: PresetKey
  from?: string
  to?: string
}

export interface Preset {
  key: Exclude<PresetKey, 'custom'>
  label: string
  /** Rolling presets are the last N days, today included. Month presets are exact ranges. */
  days?: number
}

export const PRESETS: Preset[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '28d', label: 'Last 28 days', days: 28 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: '365d', label: 'Last 365 days', days: 365 },
  { key: 'month', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
]

export const MAX_RANGE_DAYS = 366
const DEFAULT: Timeframe = { preset: '28d' }
const KEY = 'tickstream:studio-timeframe'
const DAY_MS = 86_400_000
const DATE = /^\d{4}-\d{2}-\d{2}$/

export const dayToMs = (day: string) => Date.parse(`${day}T00:00:00Z`)
export const msToDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const todayUtc = () => msToDay(Date.now())
export const spanDays = (from: string, to: string) => Math.round((dayToMs(to) - dayToMs(from)) / DAY_MS) + 1

export function isValidRange(from: unknown, to: unknown): from is string {
  if (typeof from !== 'string' || typeof to !== 'string' || !DATE.test(from) || !DATE.test(to)) return false
  if (Number.isNaN(dayToMs(from)) || Number.isNaN(dayToMs(to))) return false
  return from <= to && to <= todayUtc() && spanDays(from, to) <= MAX_RANGE_DAYS
}

/** The query string the stats endpoint understands for a timeframe. */
export function timeframeQuery(frame: Timeframe): string {
  const preset = PRESETS.find((item) => item.key === frame.preset)
  if (preset?.days) return `days=${preset.days}`
  if (frame.preset === 'month' || frame.preset === 'lastMonth') {
    const now = new Date()
    const first = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (frame.preset === 'lastMonth' ? 1 : 0), 1)
    const last = frame.preset === 'lastMonth' ? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0) : Date.now()
    return `from=${msToDay(first)}&to=${msToDay(last)}`
  }
  if (isValidRange(frame.from, frame.to)) return `from=${frame.from}&to=${frame.to}`
  return 'days=28'
}

/** First and last day (UTC) a timeframe covers right now. */
export function resolveRange(frame: Timeframe): { from: string; to: string } {
  const params = new URLSearchParams(timeframeQuery(frame))
  const from = params.get('from')
  const to = params.get('to')
  if (from && to) return { from, to }
  const days = Number(params.get('days') ?? 28)
  const today = todayUtc()
  return { from: msToDay(dayToMs(today) - (days - 1) * DAY_MS), to: today }
}

export function timeframeLabel(frame: Timeframe): string {
  if (frame.preset === 'custom') return 'Custom range'
  return PRESETS.find((item) => item.key === frame.preset)?.label ?? 'Last 28 days'
}

function parse(raw: string | null): Timeframe {
  if (!raw) return DEFAULT
  try {
    const value = JSON.parse(raw) as Partial<Timeframe>
    if (value.preset === 'custom') return isValidRange(value.from, value.to) ? { preset: 'custom', from: value.from, to: value.to } : DEFAULT
    if (PRESETS.some((item) => item.key === value.preset)) return { preset: value.preset as PresetKey }
  } catch {
    // A damaged value falls back to the default.
  }
  return DEFAULT
}

const listeners = new Set<() => void>()
let cachedRaw: string | null | undefined
let cached: Timeframe = DEFAULT

/** The snapshot must be the same object until the stored value changes, or React would re-render forever. */
function read(): Timeframe {
  const raw = safeStorage.get(KEY)
  if (raw !== cachedRaw) {
    cachedRaw = raw
    cached = parse(raw)
  }
  return cached
}

/** The timeframe every Studio screen shares. It is remembered, so moving between screens keeps it. */
export function useTimeframe(): [Timeframe, (frame: Timeframe) => void] {
  const frame = useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    read,
    () => DEFAULT,
  )
  const set = useCallback((next: Timeframe) => {
    safeStorage.set(KEY, JSON.stringify(next))
    listeners.forEach((notify) => notify())
  }, [])
  return [frame, set]
}

/**
 * The numbers for the chosen timeframe. While a new timeframe loads, the previous numbers stay on screen (marked
 * `refreshing`) so the page does not flash empty on every change.
 */
export function useStudioStats() {
  const [frame] = useTimeframe()
  const query = useApi<{ stats: StudioStats }>(`creator/stats?${timeframeQuery(frame)}`)
  const fresh = query.data?.stats ?? null
  const [kept, setKept] = useState<StudioStats | null>(null)
  useEffect(() => {
    if (fresh) setKept(fresh)
  }, [fresh])
  const stats = fresh ?? (query.loading ? kept : null)
  return { stats, loading: query.loading, refreshing: query.loading && fresh === null && stats !== null, error: query.error, reload: query.reload }
}
