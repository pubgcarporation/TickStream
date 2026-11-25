import { KeyRound, Wallet } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { PAID_AHEAD_SEGMENTS, SEGMENT_SECONDS } from '@shared/constants'
import { Button } from '@/components/ui/primitives'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { formatDuration, formatMicro, ratePerHour, ratePerMinute } from '@/lib/format'
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
  // Playback starts with the first second and the one after it paid, then one more second is paid as each new one starts.
  const firstCost = priceMicro * SEGMENT_SECONDS * (1 + PAID_AHEAD_SEGMENTS)
  const secondCost = priceMicro * SEGMENT_SECONDS
  const available = balance?.available ?? 0n
  const hasFunds = available >= BigInt(firstCost)

  const action = (
    <WalletConnect>
      {({ isConnected, show }) => {
        if (!isConnected) {
          return (
            <Button shape="rect" className="min-h-10 w-full sm:w-auto" onClick={show}>
              <Wallet className="size-4" aria-hidden /> Connect wallet
            </Button>
          )
        }
        if (!user) {
          return (
            <Button shape="rect" className="min-h-10 w-full sm:w-auto" loading={signingIn} onClick={() => void signIn()}>
              Sign in to watch
            </Button>
          )
        }
        if (!spender) {
          return (
            <Button
              shape="rect"
              className="min-h-10 w-full sm:w-auto"
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
            <Button shape="rect" className="min-h-10 w-full sm:w-auto" onClick={onAddFunds}>
              Add money to start
            </Button>
          )
        }
        return (
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {resumeAt > 0 && (
              <Button shape="rect" className="min-h-10 flex-1 sm:flex-none" loading={starting} onClick={() => onResumeAt(resumeAt)}>
                Resume at {formatDuration(resumeAt)}
              </Button>
            )}
            <Button
              shape="rect"
              className="min-h-10 flex-1 sm:flex-none sm:px-6"
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
    <section id="payment" aria-label="Payment" className="scroll-mt-32 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-baseline gap-3">
          <p className="text-2xl font-semibold tabular-nums">
            ${formatMicro(priceMicro)}
            <span className="ml-1 text-sm font-medium text-[var(--subtle)]">/ sec</span>
          </p>
          <p className="text-xs tabular-nums text-[var(--muted)]">
            ${ratePerMinute(priceMicro)} / min · ${ratePerHour(priceMicro)} / hour
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto sm:w-auto">
          {balance && !hasFunds && (
            <p className="text-sm tabular-nums text-[var(--muted)]">
              Balance <span className="font-medium text-[var(--ink)]">{formatMicro(balance.available)}</span> USDC{' '}
              <button type="button" onClick={onAddFunds} className="ml-1 text-xs font-semibold text-[var(--accent)] hover:underline">
                Add funds
              </button>
            </p>
          )}
          {action}
        </div>
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
        <span className="tabular-nums">${formatMicro(secondCost)} every second, paid one second ahead of playback. Payments are final</span>
        <span aria-hidden>·</span>
        <span>Pause or leave and payments stop</span>
        {previewSeconds > 0 && (
          <>
            <span aria-hidden>·</span>
            <span className="font-medium text-[var(--success)]">First {previewSeconds}s free</span>
          </>
        )}
        {durationSeconds ? (
          <>
            <span aria-hidden>·</span>
            <span className="tabular-nums">Whole video ${formatMicro(priceMicro * durationSeconds)}</span>
          </>
        ) : null}
      </p>
      {!spender && user && <p className="mt-1 text-xs text-[var(--subtle)]">Your wallet asks for a free signature, twice the first time. It sends no money and costs no gas.</p>}
      {message && <p className="mt-2 text-pretty text-sm text-[var(--warn)]">{message}</p>}
      {balanceError && <p className="mt-2 text-xs text-[var(--danger)]">Could not read your spending balance: {balanceError}</p>}
    </section>
  )
}
