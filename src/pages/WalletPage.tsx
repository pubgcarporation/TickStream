import { Copy, ExternalLink, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { toast } from 'sonner'
import { RequireAuth } from '@/components/creator/RequireAuth'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Button, Panel } from '@/components/ui/primitives'
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
    <div className="mx-auto max-w-xl space-y-5">
      <Panel>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">Spending balance</p>
        <p className="display mt-3 text-6xl font-bold tabular-nums">
          {balance ? <AnimatedAmount micro={Number(balance.available)} /> : loading ? '...' : '0.00'}
          <span className="ml-2 text-xl font-medium text-[var(--subtle)]">USDC</span>
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          What videos are paid from. It lives in Circle Gateway on {ARC.name}, so payments cost you no network fees.
        </p>
        {error && <p className="mt-2 text-sm text-[var(--danger)]">Could not read the balance: {error}</p>}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => setDeposit(true)} className="flex-1">
            Add money
          </Button>
          <Button variant="secondary" onClick={() => setWithdraw(true)} disabled={!balance || balance.available === 0n}>
            Move back to wallet
          </Button>
        </div>
      </Panel>

      <Panel className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--muted)]">Your wallet</span>
          <span className="font-semibold tabular-nums">
            {walletBalance !== undefined ? formatMicro(walletBalance) : '...'} <span className="text-xs text-[var(--subtle)]">USDC</span>
          </span>
        </div>
        <p className="text-xs text-[var(--subtle)]">
          Need test USDC to add?{' '}
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--accent)]">
            Get some from the Circle faucet
          </a>
          .
        </p>
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-[var(--accent)]" aria-hidden />
          <h2 className="display text-lg font-semibold">Your spending address</h2>
        </div>
        <p className="text-pretty text-sm text-[var(--muted)]">
          A small signing key stored in this browser. It signs each payment so playback never stops for a pop-up. Keep only what you plan to spend here.
        </p>
        {spender && (
          <div className="glass-inner flex items-center gap-2 rounded-2xl px-4 py-3">
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
          <div>
            <Button variant="ghost" onClick={() => setRevealed((value) => !value)} className="min-h-10 px-3">
              {revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {revealed ? 'Hide recovery key' : 'Show recovery key'}
            </Button>
            {revealed && (
              <div className="mt-2 space-y-2">
                <p className="mono break-all rounded-2xl bg-black/30 p-3 text-xs">{loadSpendingKey(address)}</p>
                <p className="text-xs text-[var(--warn)]">
                  Anyone with this key can spend the balance above. Never share it. Clearing your browser data removes it, so move money back before you do.
                </p>
              </div>
            )}
          </div>
        )}
      </Panel>

      <DepositSheet open={deposit} onClose={() => setDeposit(false)} />
      <WithdrawSheet open={withdraw} onClose={() => setWithdraw(false)} />
    </div>
  )
}

export function WalletPage() {
  return (
    <div className="space-y-6">
      <h1 className="display text-4xl font-bold">Wallet</h1>
      <RequireAuth title="Sign in to see your wallet" body="Sign in to add money and see your spending balance.">
        <WalletContent />
      </RequireAuth>
    </div>
  )
}
