import { TokenUSDC } from '@web3icons/react'
import { KeyRound, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PAY_BLOCK_SECONDS } from '@shared/constants'
import { Button } from '@/components/ui/primitives'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { formatDuration, formatMicro } from '@/lib/format'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

interface StartPanelProps {
  priceMicro: number
  durationSeconds: number | null
  previewSeconds: number
  resumeAt: number
  onResumeAt: (second: number) => void
  onStart: () => void
  onAddFunds: () => void
  starting: boolean
  message: string | null
}

export function StartPanel({ priceMicro, durationSeconds, previewSeconds, resumeAt, onResumeAt, onStart, onAddFunds, starting, message }: StartPanelProps) {
  const { user, signIn, signingIn } = useAuth()
  const { balance, spender, unlock, error: balanceError } = useSpendingWallet()
  const [unlocking, setUnlocking] = useState(false)
  // Playback starts with the first 2 seconds paid and the next 2 paid right after, then 2 more as each block starts.
  const firstCost = priceMicro * PAY_BLOCK_SECONDS * 2
  const blockCost = priceMicro * PAY_BLOCK_SECONDS
  const available = balance?.available ?? 0n
  const hasFunds = available >= BigInt(firstCost)

  const action = (
    <WalletConnect>
      {({ isConnected, show, loading }) => {
        if (loading) return <span className="skeleton block h-9 w-32 rounded-full" aria-hidden />
        if (!isConnected) {
          return (
            <Button shape="rect" className="!min-h-9 px-4" onClick={show}>
              <Wallet className="size-4" aria-hidden /> Connect wallet
            </Button>
          )
        }
        if (!user) {
          return (
            <Button shape="rect" className="!min-h-9 px-4" loading={signingIn} onClick={() => void signIn()}>
              Sign in to watch
            </Button>
          )
        }
        if (!spender) {
          return (
            <Button
              shape="rect"
              className="!min-h-9 px-4"
              loading={unlocking}
              onClick={() => {
                setUnlocking(true)
                unlock()
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Could not unlock'))
                  .finally(() => setUnlocking(false))
              }}
            >
              <KeyRound className="size-4" aria-hidden /> Set up spending wallet
            </Button>
          )
        }
        if (!hasFunds) {
          return (
            <Button shape="rect" className="!min-h-9 px-4" onClick={onAddFunds}>
              Add money to start
            </Button>
          )
        }
        return (
          <div className="flex flex-wrap gap-2">
            {resumeAt > 0 && (
              <Button shape="rect" className="!min-h-9 px-4" loading={starting} onClick={() => onResumeAt(resumeAt)}>
                Resume at {formatDuration(resumeAt)}
              </Button>
            )}
            <Button
              shape="rect"
              className="!min-h-9 px-4"
              variant={resumeAt > 0 ? 'secondary' : 'primary'}
              loading={starting && resumeAt === 0}
              onClick={onStart}
            >
              {resumeAt > 0 ? 'From the start' : 'Start watching'}
            </Button>
          </div>
        )
      }}
    </WalletConnect>
  )

  return (
    <section id="payment" aria-label="Payment" className="scroll-mt-32 space-y-1 px-4 py-2 sm:px-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex min-w-0 items-baseline gap-2 tabular-nums">
          <span className="flex shrink-0 items-center gap-1 text-base font-semibold">
            <TokenUSDC variant="branded" size={18} aria-hidden />
            {formatMicro(priceMicro)}
            <span className="ml-0.5 text-xs font-medium text-[var(--subtle)]">/ sec</span>
          </span>
          {durationSeconds ? (
            <span className="flex min-w-0 items-center gap-1 truncate text-xs text-[var(--muted)]" title="Cost to watch the whole video">
              <TokenUSDC variant="branded" size={14} aria-hidden />
              {formatMicro(priceMicro * durationSeconds)} full video
            </span>
          ) : null}
        </p>
        <div className="flex items-center gap-3">
          {balance && !hasFunds && (
            <p className="text-xs tabular-nums text-[var(--muted)]">
              Balance <span className="font-medium text-[var(--ink)]">{formatMicro(balance.available)}</span> USDC
            </p>
          )}
          {action}
        </div>
      </div>
      <p className="text-xs leading-[18px] text-[var(--muted)]">
        <span className="tabular-nums">{formatMicro(blockCost)} USDC every {PAY_BLOCK_SECONDS} seconds, always paid {PAY_BLOCK_SECONDS} seconds ahead.</span> Pause or leave and payments stop.
        {previewSeconds > 0 && <span className="ml-1 font-medium text-[var(--success)]">First {previewSeconds}s free.</span>}
      </p>
      {!spender && user && <p className="text-xs text-[var(--subtle)]">Your wallet asks for a free signature, twice the first time. It sends no money and costs no gas.</p>}
      {message && <p className="text-pretty text-sm text-[var(--warn)]">{message}</p>}
      {balanceError && <p className="text-xs text-[var(--danger)]">Could not read your spending balance: {balanceError}</p>}
    </section>
  )
}
