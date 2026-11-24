import { createChainPoller, type ChainReply, type ChainRequest } from '@/lib/chain-poller'
import type { ChainSnapshot } from '@/lib/arcscan'

/**
 * One shared connection to the onchain data loop. Every component that shows a balance or activity for an address
 * reads from the same store, so a page with five widgets still makes one request loop per address.
 */

export interface ChainState {
  snapshot: ChainSnapshot | null
  error: string | null
}

const EMPTY: ChainState = { snapshot: null, error: null }

const states = new Map<string, ChainState>()
const listeners = new Map<string, Set<() => void>>()
let send: ((message: ChainRequest) => void) | null = null

function receive(reply: ChainReply) {
  const address = (reply.type === 'snapshot' ? reply.snapshot.address : reply.address).toLowerCase()
  const previous = states.get(address) ?? EMPTY
  states.set(
    address,
    reply.type === 'snapshot'
      ? { snapshot: reply.snapshot, error: null }
      : { snapshot: previous.snapshot, error: reply.message },
  )
  listeners.get(address)?.forEach((notify) => notify())
}

function connect(): (message: ChainRequest) => void {
  if (send) return send
  try {
    const worker = new Worker(new URL('../workers/chain.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<ChainReply>) => receive(event.data)
    worker.onerror = () => {
      // The worker could not start. Carry on with the same loop on the page.
      worker.terminate()
      const local = createChainPoller(receive)
      send = (message) => local.handle(message)
      for (const address of listeners.keys()) if (listeners.get(address)?.size) send({ type: 'watch', address })
    }
    send = (message) => worker.postMessage(message)
  } catch {
    const local = createChainPoller(receive)
    send = (message) => local.handle(message)
  }
  document.addEventListener('visibilitychange', () => send?.({ type: 'visible', visible: !document.hidden }))
  return send
}

export function subscribeChain(address: string, notify: () => void): () => void {
  const key = address.toLowerCase()
  let set = listeners.get(key)
  if (!set) listeners.set(key, (set = new Set()))
  set.add(notify)
  if (set.size === 1) connect()({ type: 'watch', address: key })
  return () => {
    set.delete(notify)
    if (set.size === 0) send?.({ type: 'unwatch', address: key })
  }
}

export function getChainState(address: string | undefined): ChainState {
  return (address && states.get(address.toLowerCase())) || EMPTY
}

/** Fetch again now, for example right after a deposit lands. */
export function refreshChain(address: string | undefined) {
  if (address) send?.({ type: 'refresh', address: address.toLowerCase() })
}
