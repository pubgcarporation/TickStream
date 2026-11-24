import { useCallback, useSyncExternalStore } from 'react'
import type { StudioStats } from '@shared/types'
import { useApi } from '@/hooks/useApi'
import { safeStorage } from '@/lib/safe-storage'

export const RANGES = [
  { days: 7, label: '7 days' },
  { days: 28, label: '28 days' },
  { days: 90, label: '90 days' },
] as const

const KEY = 'tickstream:studio-range'
const listeners = new Set<() => void>()

function read(): number {
  const stored = Number(safeStorage.get(KEY))
  return RANGES.some((range) => range.days === stored) ? stored : 28
}

/** The period every Studio screen shows. It is remembered, so moving between screens keeps it. */
export function useStudioRange(): [number, (days: number) => void] {
  const days = useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    read,
    () => 28,
  )
  const set = useCallback((next: number) => {
    safeStorage.set(KEY, String(next))
    listeners.forEach((notify) => notify())
  }, [])
  return [days, set]
}

export function useStudioStats(days: number) {
  const query = useApi<{ stats: StudioStats }>(`creator/stats?days=${days}`)
  return { stats: query.data?.stats ?? null, loading: query.loading, error: query.error, reload: query.reload }
}
