import { ArcscanError, fetchSnapshot, type ChainSnapshot } from '@/lib/arcscan'

/**
 * The polling core for onchain data. It runs inside a Web Worker so network waits and JSON parsing never touch the
 * page, and it also runs on the page when Workers are not available.
 *
 * It keeps one request loop per watched address, never overlaps two requests for the same address, pauses while the
 * tab is hidden, and backs off when the explorer asks it to slow down.
 */

export type ChainRequest =
  | { type: 'watch'; address: string }
  | { type: 'unwatch'; address: string }
  | { type: 'refresh'; address: string }
  | { type: 'visible'; visible: boolean }

export type ChainReply =
  | { type: 'snapshot'; snapshot: ChainSnapshot }
  | { type: 'error'; address: string; message: string }

const POLL_MS = 10_000

interface Watch {
  timer: ReturnType<typeof setTimeout> | null
  inFlight: boolean
  blockedUntil: number
}

export function createChainPoller(post: (reply: ChainReply) => void) {
  const watches = new Map<string, Watch>()
  let visible = true

  function schedule(address: string, watch: Watch, delay: number) {
    if (watch.timer) clearTimeout(watch.timer)
    watch.timer = setTimeout(() => void tick(address), delay)
  }

  async function tick(address: string) {
    const watch = watches.get(address)
    if (!watch) return
    if (!visible) return // resumed by the next 'visible' message
    if (watch.inFlight) return
    const wait = watch.blockedUntil - Date.now()
    if (wait > 0) return schedule(address, watch, wait)

    watch.inFlight = true
    try {
      post({ type: 'snapshot', snapshot: await fetchSnapshot(address) })
    } catch (error) {
      if (error instanceof ArcscanError && error.retryAfterSeconds) {
        watch.blockedUntil = Date.now() + error.retryAfterSeconds * 1000
      }
      post({ type: 'error', address, message: error instanceof Error ? error.message : 'Could not load onchain data' })
    } finally {
      watch.inFlight = false
      if (watches.has(address)) schedule(address, watch, Math.max(POLL_MS, watch.blockedUntil - Date.now()))
    }
  }

  return {
    handle(message: ChainRequest) {
      if (message.type === 'visible') {
        visible = message.visible
        if (visible) for (const [address, watch] of watches) schedule(address, watch, 0)
        return
      }
      const address = message.address.toLowerCase()
      if (message.type === 'watch') {
        if (watches.has(address)) return
        const watch: Watch = { timer: null, inFlight: false, blockedUntil: 0 }
        watches.set(address, watch)
        schedule(address, watch, 0)
      } else if (message.type === 'unwatch') {
        const watch = watches.get(address)
        if (watch?.timer) clearTimeout(watch.timer)
        watches.delete(address)
      } else {
        const watch = watches.get(address)
        if (watch) schedule(address, watch, 0)
      }
    },
  }
}
