import { Wallet } from 'lucide-react'
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
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
      <div className="space-y-1 p-5 pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-[var(--subtle)]">Pay per second</p>
        <p className="text-3xl font-semibold tabular-nums">
          ${formatMicro(priceMicro)}
          <span className="ml-1.5 text-base font-medium text-[var(--subtle)]">/ sec</span>
        </p>
        <p className="text-xs tabular-nums text-[var(--muted)]">
          ${ratePerMinute(priceMicro)} per minute · ${ratePerHour(priceMicro)} per hour
        </p>
      </div>

      <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] px-5">
        {durationSeconds ? <Row label={`Full video (${formatDuration(durationSeconds)})`} value={`$${formatMicro(priceMicro * durationSeconds)}`} /> : null}
        {previewSeconds > 0 && <Row label="Free preview" value={`First ${previewSeconds}s`} />}
        <Row label="Pausing" value="Stops charging" />
      </dl>

      <div className="space-y-5 p-5">
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">Spending limit</p>
            <p className="text-xs text-[var(--subtle)]">USDC, this session</p>
          </div>
          <Segmented
            label="Spending limit"
            value={capMicro}
            onChange={onCap}
            options={CAP_CHOICES.map((cap) => ({ value: cap, label: formatMicro(cap), disabled: !affordable.includes(cap) }))}
          />
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm font-medium">Payment interval</p>
            <p className="text-xs text-[var(--subtle)]">${formatMicro(chunkCost)} each</p>
          </div>
          <Segmented
            label="Payment interval"
            value={chunkSeconds}
            onChange={onChunk}
            options={CHUNK_SECONDS_OPTIONS.map((seconds) => ({ value: seconds, label: `${seconds}s` }))}
          />
          <p className="mt-2 text-pretty text-xs text-[var(--subtle)]">
            You pay ahead one interval at a time, so this is the most you can be charged for video you have not watched.
          </p>
        </div>

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
