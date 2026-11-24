import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { createReadOnlyGatewayClient, isUnlocked, lockSpendingKey, readIdentity, unlockSpendingKey, type KeyMode, type SpendingIdentity } from '@/lib/spending-wallet'

interface GatewayBalance {
  /** Spendable now, in USDC base units (6 decimals). */
  available: bigint
  /** Total held in Gateway for this spending address, including amounts still settling. */
  total: bigint
}

interface SpendingWalletState {
  /** The verified spending address, once this wallet has unlocked it at least once. */
  spender: `0x${string}` | undefined
  keyMode: KeyMode | null
  /** True when the key is ready to sign in this tab. */
  unlocked: boolean
  balance: GatewayBalance | null
  loading: boolean
  error: string | null
  refresh: () => Promise<GatewayBalance | null>
  /** Makes the key ready (the wallet may ask for a free signature) and returns the spending address. */
  unlock: () => Promise<`0x${string}`>
}

const SpendingWalletContext = createContext<SpendingWalletState | null>(null)

export function SpendingWalletProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [identity, setIdentity] = useState<{ owner: string; value: SpendingIdentity } | null>(null)
  const [ready, setReady] = useState<string | null>(null)
  const [balance, setBalance] = useState<GatewayBalance | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef<Promise<`0x${string}`> | null>(null)

  const owner = address?.toLowerCase()
  // Only an address already verified for this wallet is trusted. A new wallet has none until it unlocks.
  const known = owner ? (identity?.owner === owner ? identity.value : readIdentity(owner)) : null
  const spender = known?.address
  const unlocked = Boolean(owner && ready === owner && isUnlocked(owner))

  // Switching or disconnecting wallets forgets any key held in memory.
  useEffect(() => {
    return () => {
      lockSpendingKey()
      setReady(null)
    }
  }, [owner])

  const refresh = useCallback(async (): Promise<GatewayBalance | null> => {
    if (!address || !spender) {
      setBalance(null)
      return null
    }
    setLoading(true)
    try {
      const balances = await createReadOnlyGatewayClient().getBalances(spender)
      const next = { available: balances.gateway.available, total: balances.gateway.total }
      setBalance(next)
      setError(null)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read your balance')
      return null
    } finally {
      setLoading(false)
    }
  }, [address, spender])

  useEffect(() => {
    // Defer so state updates never run synchronously inside the effect body.
    const first = setTimeout(() => void refresh(), 0)
    const interval = setInterval(() => void refresh(), 15_000)
    return () => {
      clearTimeout(first)
      clearInterval(interval)
    }
  }, [refresh])

  const unlock = useCallback(async (): Promise<`0x${string}`> => {
    if (!address) throw new Error('Connect your wallet first')
    if (pending.current) return pending.current
    const run = (async () => {
      try {
        const result = await unlockSpendingKey(address, (message) => signMessageAsync({ message }))
        setIdentity({ owner: address.toLowerCase(), value: result })
        setReady(address.toLowerCase())
        return result.address
      } finally {
        pending.current = null
      }
    })()
    pending.current = run
    return run
  }, [address, signMessageAsync])

  const value = useMemo(
    () => ({ spender, keyMode: known?.mode ?? null, unlocked, balance, loading, error, refresh, unlock }),
    [spender, known?.mode, unlocked, balance, loading, error, refresh, unlock],
  )
  return <SpendingWalletContext.Provider value={value}>{children}</SpendingWalletContext.Provider>
}

export function useSpendingWallet(): SpendingWalletState {
  const context = useContext(SpendingWalletContext)
  if (!context) throw new Error('useSpendingWallet must be used inside SpendingWalletProvider')
  return context
}
