import { useCallback, useEffect, useState } from 'react'
import { createGatewayClient } from '@/lib/spending-wallet'

/** Reads the Circle Gateway balance held for any address (for example a creator's payout balance). */
export function useGatewayBalanceOf(address: string | undefined) {
  const [state, setState] = useState<{ available: bigint; total: bigint } | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!address) return
    let cancelled = false
    createGatewayClient(address)
      .getBalances(address as `0x${string}`)
      .then((result) => {
        if (!cancelled) setState({ available: result.gateway.available, total: result.gateway.total })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [address, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  return { balance: state, reload }
}
