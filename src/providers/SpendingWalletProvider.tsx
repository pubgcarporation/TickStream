import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAccount } from 'wagmi'
import { createGatewayClient, getSpendingAccount } from '@/lib/spending-wallet'

interface GatewayBalance {
  /** Spendable now, in USDC base units (6 decimals). */
  available: bigint
  /** Total held in Gateway for this spending address, including amounts still settling. */
  total: bigint
}

interface SpendingWalletState {
  spender: `0x${string}` | undefined
  balance: GatewayBalance | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const SpendingWalletContext = createContext<SpendingWalletState | null>(null)

export function SpendingWalletProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const [balance, setBalance] = useState<GatewayBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const spender = useMemo(() => (address ? getSpendingAccount(address).address : undefined), [address])

  const refresh = useCallback(async () => {
    if (!address) {
      setBalance(null)
      return
    }
    setLoading(true)
    try {
      const balances = await createGatewayClient(address).getBalances()
      setBalance({ available: balances.gateway.available, total: balances.gateway.total })
      setError(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read your balance')
    } finally {
      setLoading(false)
    }
  }, [address])

  useEffect(() => {
    // Defer so state updates never run synchronously inside the effect body.
    const first = setTimeout(() => void refresh(), 0)
    const interval = setInterval(() => void refresh(), 15_000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [refresh])

  const value = useMemo(() => ({ spender, balance, loading, error, refresh }), [spender, balance, loading, error, refresh])
  return <SpendingWalletContext.Provider value={value}>{children}</SpendingWalletContext.Provider>
}

export function useSpendingWallet(): SpendingWalletState {
  const context = useContext(SpendingWalletContext)
  if (!context) throw new Error('useSpendingWallet must be used inside SpendingWalletProvider')
  return context
}
