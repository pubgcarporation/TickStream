import { Copy, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { toast } from 'sonner'
import { RequireAuth } from '@/components/creator/RequireAuth'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Button } from '@/components/ui/primitives'
import { DepositSheet } from '@/components/wallet/DepositSheet'
import { WithdrawSheet } from '@/components/wallet/WithdrawSheet'
import { addressLink, ARC } from '@/lib/arc'
import { formatMicro, shortAddress } from '@/lib/format'
import { loadSpendingKey } from '@/lib/spending-wallet'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

function WalletContent() {
  const { address } = useAccount()
  const { spender, balance, loading, error } = useSpendingWallet()
  const [deposit, setDeposit] = useState(false)
  const [withdraw, setWithdraw] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const { data: walletBalance } = useReadContract({
    address: ARC.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC.chainId,
    query: { enabled: Boolean(address), refetchInterval: 10_000 },
  })

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  return (
    <div className="max-w-xl divide-y divide-[var(--border)]">
      <section className="pb-6">
        <p className="text-xs font-medium text-[var(--subtle)]">Spending balance</p>
        <p className="mt-1 text-5xl font-semibold tabular-nums">
          {balance ? <AnimatedAmount micro={Number(balance.available)} /> : loading ? '...' : '0.00'}
          <span className="ml-2 text-lg font-medium text-[var(--subtle)]">USDC</span>
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">Videos are paid from this. It sits in Circle Gateway on {ARC.name}, so payments cost no network fees.</p>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">Could not read the balance: {error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setDeposit(true)}>Add money</Button>
          <Button variant="secondary" onClick={() => setWithdraw(true)} disabled={!balance || balance.available === 0n}>
            Move back to wallet
          </Button>
        </div>
      </section>

      <section className="py-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--muted)]">Your wallet</span>
          <span className="font-semibold tabular-nums">
            {walletBalance !== undefined ? formatMicro(walletBalance) : '...'} <span className="text-xs font-normal text-[var(--subtle)]">USDC</span>
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--subtle)]">
          Need test USDC?{' '}
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)]">
            Circle faucet
          </a>
        </p>
      </section>

      <section className="pt-5">
        <h2 className="text-sm font-semibold">Spending address</h2>
        <p className="mt-1 text-pretty text-sm text-[var(--muted)]">
          A small signing key kept in this browser. It signs each payment so playback never stops for a pop-up. Keep only what you plan to spend here.
        </p>
        {spender && (
          <div className="mt-3 flex items-center gap-1">
            <span className="mono min-w-0 flex-1 truncate text-xs" title={spender}>
              {shortAddress(spender)}
            </span>
            <button onClick={() => void copy(spender, 'Address')} aria-label="Copy address" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
              <Copy className="size-4" />
            </button>
            <a href={addressLink(spender)} target="_blank" rel="noopener noreferrer" aria-label="View on the explorer" className="flex size-9 items-center justify-center rounded-full hover:bg-white/10">
              <ExternalLink className="size-4" />
            </a>
          </div>
        )}
        {address && (
          <div className="mt-1">
            <Button variant="ghost" onClick={() => setRevealed((value) => !value)} className="-ml-3 min-h-9 px-3">
              {revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {revealed ? 'Hide recovery key' : 'Show recovery key'}
            </Button>
            {revealed && (
              <>
                <p className="mono mt-1 break-all text-xs">{loadSpendingKey(address)}</p>
                <p className="mt-2 text-xs text-[var(--warn)]">
                  Anyone with this key can spend the balance above. Never share it. Clearing browser data removes it, so move money back first.
                </p>
              </>
            )}
          </div>
        )}
      </section>

      <DepositSheet open={deposit} onClose={() => setDeposit(false)} />
      <WithdrawSheet open={withdraw} onClose={() => setWithdraw(false)} />
    </div>
  )
}

export function WalletPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Wallet</h1>
      <RequireAuth title="Sign in to see your wallet" body="Sign in to add money and see your spending balance.">
        <WalletContent />
      </RequireAuth>
    </div>
  )
}
