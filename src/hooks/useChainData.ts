import { useCallback, useSyncExternalStore } from 'react'
import { erc20Abi } from 'viem'
import { useReadContract } from 'wagmi'
import type { ActivityItem } from '@/lib/arcscan'
import { ARC } from '@/lib/arc'
import { getChainState, refreshChain, subscribeChain } from '@/lib/chain-data'

const NO_ACTIVITY: ActivityItem[] = []
const noop = () => () => {}

/**
 * USDC balance and recent activity for an address, from the Arcscan explorer API through a background worker.
 * The balance is the ERC-20 view (6 decimals). If the explorer cannot be reached, the balance falls back to the RPC.
 */
export function useChainData(address: `0x${string}` | undefined) {
  const subscribe = useCallback((notify: () => void) => (address ? subscribeChain(address, notify) : noop()), [address])
  const state = useSyncExternalStore(subscribe, () => getChainState(address))

  const needsRpc = Boolean(address) && !state.snapshot && Boolean(state.error)
  const rpc = useReadContract({
    abi: erc20Abi,
    address: ARC.usdcAddress,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC.chainId,
    query: { enabled: needsRpc, refetchInterval: 10_000 },
  })

  const explorerBalance = state.snapshot ? BigInt(state.snapshot.balance) : null
  const balance = explorerBalance ?? (needsRpc ? (rpc.data ?? null) : null)

  return {
    balance,
    activity: state.snapshot?.activity ?? NO_ACTIVITY,
    loading: Boolean(address) && balance === null && !state.error,
    error: state.error,
    source: explorerBalance !== null ? ('arcscan' as const) : needsRpc ? ('rpc' as const) : null,
    refresh: useCallback(() => refreshChain(address), [address]),
  }
}
