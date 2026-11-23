import { Wallet } from 'lucide-react'
import { CHUNK_SECONDS_OPTIONS } from '@shared/constants'
import { Button, Chip, Panel } from '@/components/ui/primitives'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { formatDuration, formatMicro, ratePerHour, ratePerMinute } from '@/lib/format'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

const CAP_CHOICES = [100_000, 500_000, 1_000_000, 5_000_000]

interface StartPanelProps {
  priceMicro: number
  durationSeconds: number | null
  previewSeconds: number
  resumeAt: number
  onResumeAt: (second: number) => void
  chunkSeconds: number
  capMicro: number
  onChunk: (seconds: number) => void
  onCap: (micro: number) => void
  onStart: () => void
  onAddFunds: () => void
  starting: boolean
  message: string | null
}

export function StartPanel({ priceMicro, durationSeconds, previewSeconds, resumeAt, onResumeAt, chunkSeconds, capMicro, onChunk, onCap, onStart, onAddFunds, starting, message }: StartPanelProps) {
  const { user, signIn, signingIn } = useAuth()
  const { balance, error: balanceError } = useSpendingWallet()
  const chunkCost = priceMicro * chunkSeconds
  const available = balance?.available ?? 0n
  const affordable = CAP_CHOICES.filter((cap) => cap >= chunkCost && BigInt(cap) <= available)
  const hasFunds = available >= BigInt(chunkCost)
  const capOk = capMicro >= chunkCost && BigInt(capMicro) <= available

  return (
    <Panel className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">Price</p>
        <p className="display mt-2 text-4xl font-bold tabular-nums">
          ${formatMicro(priceMicro)}
          <span className="ml-1 text-lg font-medium text-[var(--subtle)]">/ second</span>
        </p>
        <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
          {ratePerMinute(priceMicro)} a minute, {ratePerHour(priceMicro)} an hour. Pausing stops the meter.
        </p>
        {durationSeconds ? (
          <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
            About <span className="font-semibold text-[var(--ink)]">${formatMicro(priceMicro * durationSeconds)}</span> to watch all {formatDuration(durationSeconds)}.
          </p>
        ) : null}
        {previewSeconds > 0 && (
          <p className="mt-2 inline-block rounded-full bg-[var(--success)]/15 px-3 py-1 text-xs font-semibold text-[var(--success)]">
            First {previewSeconds} seconds are free
          </p>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Spending cap for this session</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Spending cap">
          {CAP_CHOICES.map((cap) => (
            <Chip key={cap} active={capMicro === cap} disabled={!affordable.includes(cap)} onClick={() => onCap(cap)}>
              {formatMicro(cap)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-[var(--muted)]">Pay every</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Payment interval">
          {CHUNK_SECONDS_OPTIONS.map((seconds) => (
            <Chip key={seconds} active={chunkSeconds === seconds} onClick={() => onChunk(seconds)}>
              {seconds}s
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs tabular-nums text-[var(--subtle)]">
          Each payment is {formatMicro(chunkCost)} USDC. That is the most you can be charged for video you have not watched.
        </p>
      </div>

      {message && <p className="text-pretty rounded-2xl bg-white/5 p-3 text-sm text-[var(--muted)]">{message}</p>}
      {balanceError && <p className="text-xs text-[var(--danger)]">Could not read your spending balance: {balanceError}</p>}

      <WalletConnect>
        {({ isConnected, show }) => {
          if (!isConnected) {
            return (
              <Button full onClick={show}>
                <Wallet className="size-4" aria-hidden /> Sign in to watch
              </Button>
            )
          }
          if (!user) {
            return (
              <Button full loading={signingIn} onClick={() => void signIn()}>
                Sign in to watch
              </Button>
            )
          }
          if (!hasFunds) {
            return (
              <Button full onClick={onAddFunds}>
                Add money to start
              </Button>
            )
          }
          return (
            <div className="space-y-2">
              {resumeAt > 0 && (
                <Button full loading={starting} disabled={!capOk} onClick={() => onResumeAt(resumeAt)}>
                  Resume at {formatDuration(resumeAt)}
                </Button>
              )}
              <Button full variant={resumeAt > 0 ? 'secondary' : 'primary'} loading={starting && resumeAt === 0} disabled={!capOk} onClick={onStart}>
                {resumeAt > 0 ? 'Start from the beginning' : 'Start watching'}
              </Button>
            </div>
          )
        }}
      </WalletConnect>
      {balance && (
        <p className="text-center text-xs tabular-nums text-[var(--subtle)]">
          Spending balance {formatMicro(balance.available)} USDC
        </p>
      )}
    </Panel>
  )
}
