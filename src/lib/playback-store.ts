import { useSyncExternalStore } from 'react'

/** What is playing right now, so the header can show the live rate from anywhere in the app. */
export interface ActivePlayback {
  videoId: string
  priceMicro: number
}

let current: ActivePlayback | null = null
const listeners = new Set<() => void>()

export function setActivePlayback(next: ActivePlayback | null): void {
  const same = current?.videoId === next?.videoId && current?.priceMicro === next?.priceMicro
  if (same) return
  current = next
  listeners.forEach((listener) => listener())
}

export function useActivePlayback(): ActivePlayback | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => current,
    () => null,
  )
}
