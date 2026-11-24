import { ChevronDown, Wallet } from 'lucide-react'
import { CHUNK_SECONDS_OPTIONS } from '@shared/constants'
import { Button, Card, Segmented } from '@/components/ui/primitives'
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

function watchTime(capMicro: number, priceMicro: number, durationSeconds: number | null): string {
  const seconds = Math.floor(capMicro / Math.max(1, priceMicro))
  if (durationSeconds && seconds >= durationSeconds) return 'Whole video'
  return `About ${formatDuration(seconds)}`
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
    <Card className="overflow-hidden">
      <div className="p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[var(--subtle)]">Price</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              ${formatMicro(priceMicro)}
              <span className="ml-1.5 text-base font-medium text-[var(--subtle)]">/ sec</span>
            </p>
          </div>
          <p className="pb-1 text-right text-xs tabular-nums text-[var(--muted)]">
            ${ratePerMinute(priceMicro)} / min
            <br />${ratePerHour(priceMicro)} / hour
          </p>
        </div>
        <p className="mt-3 text-sm text-[var(--muted)]">
          You only pay for the seconds that play. Pause or close the tab and the meter stops.
          {previewSeconds > 0 && <span className="font-medium text-[var(--success)]"> First {previewSeconds}s are free.</span>}
        </p>
        {durationSeconds ? (
          <p className="mt-1 text-xs tabular-nums text-[var(--subtle)]">
            Watching all {formatDuration(durationSeconds)} would cost ${formatMicro(priceMicro * durationSeconds)}.
          </p>
        ) : null}
      </div>

      <div className="space-y-4 border-t border-[var(--border)] p-5">
        <div>
          <p className="text-sm font-semibold">Set a budget for this session</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">The most you can be charged. You can raise it later while watching.</p>
        </div>
        <div role="radiogroup" aria-label="Session budget" className="grid grid-cols-2 gap-2">
          {CAP_CHOICES.map((cap) => {
            const active = capMicro === cap
            const disabled = !affordable.includes(cap)
            return (
              <button
                key={cap}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={disabled}
                onClick={() => onCap(cap)}
                className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  active ? 'border-[var(--accent)] bg-[var(--accent)]/10' : 'border-[var(--border)] hover:bg-white/5'
                }`}
              >
                <span className="block text-base font-semibold tabular-nums">
                  {formatMicro(cap)} <span className="text-xs font-medium text-[var(--subtle)]">USDC</span>
                </span>
                <span className="mt-0.5 block text-xs text-[var(--muted)]">{watchTime(cap, priceMicro, durationSeconds)}</span>
              </button>
            )
          })}
        </div>

        <details className="group rounded-lg border border-[var(--border)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
            <span>
              <span className="font-medium">Billing steps</span>
              <span className="ml-2 text-[var(--muted)]">Every {chunkSeconds}s</span>
            </span>
            <ChevronDown className="size-4 text-[var(--subtle)] transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="space-y-2 border-t border-[var(--border)] p-3">
            <Segmented
              label="Billing step"
              value={chunkSeconds}
              onChange={onChunk}
              options={CHUNK_SECONDS_OPTIONS.map((seconds) => ({ value: seconds, label: `${seconds}s` }))}
            />
            <p className="text-pretty text-xs text-[var(--muted)]">
              You are charged ${formatMicro(chunkCost)} each {chunkSeconds} seconds, paid just ahead of playback. Shorter steps mean less paid in advance.
            </p>
          </div>
        </details>

        {message && <p className="text-pretty rounded-lg bg-[var(--warn)]/10 px-3 py-2 text-sm text-[var(--warn)]">{message}</p>}
        {balanceError && <p className="text-xs text-[var(--danger)]">Could not read your spending balance: {balanceError}</p>}

        <WalletConnect>
          {({ isConnected, show }) => {
            if (!isConnected) {
              return (
                <Button full shape="rect" className="min-h-12" onClick={show}>
                  <Wallet className="size-4" aria-hidden /> Connect wallet
                </Button>
              )
            }
            if (!user) {
              return (
                <Button full shape="rect" className="min-h-12" loading={signingIn} onClick={() => void signIn()}>
                  Sign in to watch
                </Button>
              )
            }
            if (!hasFunds) {
              return (
                <Button full shape="rect" className="min-h-12" onClick={onAddFunds}>
                  Add money to start
                </Button>
              )
            }
            return (
              <div className="space-y-2">
                {resumeAt > 0 && (
                  <Button full shape="rect" className="min-h-12" loading={starting} disabled={!capOk} onClick={() => onResumeAt(resumeAt)}>
                    Resume at {formatDuration(resumeAt)}
                  </Button>
                )}
                <Button
                  full
                  shape="rect"
                  className="min-h-12"
                  variant={resumeAt > 0 ? 'secondary' : 'primary'}
                  loading={starting && resumeAt === 0}
                  disabled={!capOk}
                  onClick={onStart}
                >
                  {resumeAt > 0 ? 'Start from the beginning' : 'Start watching'}
                </Button>
              </div>
            )
          }}
        </WalletConnect>
      </div>

      {balance && (
        <div className="flex items-center justify-between border-t border-[var(--border)] bg-black/20 px-5 py-3 text-sm">
          <span className="text-[var(--muted)]">Spending balance</span>
          <span className="flex items-center gap-3">
            <span className="font-medium tabular-nums">{formatMicro(balance.available)} USDC</span>
            <button type="button" onClick={onAddFunds} className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Add funds
            </button>
          </span>
        </div>
      )}
    </Card>
  )
}
