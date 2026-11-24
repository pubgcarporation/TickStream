import { Copy, ExternalLink, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react'
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
import { legacyKeyOf } from '@/lib/spending-wallet'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

function WalletContent() {
  const { address } = useAccount()
  const { spender, keyMode, unlocked, unlock, balance, loading, error } = useSpendingWallet()
  const [unlocking, setUnlocking] = useState(false)
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

  const oldKey = address ? legacyKeyOf(address) : null

  const unlockNow = async () => {
    setUnlocking(true)
    try {
      await unlock()
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not unlock')
    } finally {
      setUnlocking(false)
    }
  }

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
          {keyMode === 'derived'
            ? 'The key that signs your payments is made from a free signature by your wallet. It is never saved in this browser, and you get the same address on any device.'
            : keyMode === 'stored'
              ? 'This address uses a key saved in this browser. Move your money back and it switches to a safer key made from your wallet signature the next time you start.'
              : 'Videos are paid by a small signing key. Set it up once: your wallet signs a free message, twice, and no money moves.'}
        </p>
        {spender ? (
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
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${unlocked ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-white/5 text-[var(--muted)]'}`}>
            {unlocked ? <ShieldCheck className="size-3.5" aria-hidden /> : <KeyRound className="size-3.5" aria-hidden />}
            {unlocked ? 'Unlocked in this tab' : 'Locked'}
          </span>
          {!unlocked && (
            <Button variant="secondary" shape="rect" loading={unlocking} onClick={() => void unlockNow()} className="min-h-9">
              {spender ? 'Unlock' : 'Set up spending wallet'}
            </Button>
          )}
        </div>
        {address && oldKey && (
          <div className="mt-3">
            <Button variant="ghost" onClick={() => setRevealed((value) => !value)} className="-ml-3 min-h-9 px-3">
              {revealed ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {revealed ? 'Hide saved key' : 'Show saved key'}
            </Button>
            {revealed && (
              <>
                <p className="mono mt-1 break-all text-xs">{oldKey}</p>
                <p className="mt-2 text-xs text-[var(--warn)]">
                  Anyone with this key can spend what is under it. Never share it. Clearing browser data removes it, so move money back first.
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
