import { Check, Wallet } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from 'wagmi'
import { MAX_TIP_MESSAGE_LENGTH, MAX_TIP_MICRO, MIN_TIP_MICRO } from '@shared/constants'
import { sendTip } from '@/components/player/tips'
import { Button, Sheet, inputClass } from '@/components/ui/primitives'
import { AmountInput } from '@/components/wallet/AmountInput'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { ApiError } from '@/lib/api'
import { formatMicro } from '@/lib/format'
import { createPaymentScheme } from '@/lib/spending-wallet'
import { AmountError, formatUsdc, parseUsdc } from '@/onchain-money'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'

const CHIPS = ['0.25', '1', '5', '10']

interface TipSheetProps {
  open: boolean
  onClose: () => void
  videoId: string
  creatorName: string
  onAddFunds: () => void
}

function friendly(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'self_tip') return 'You cannot tip your own video.'
    if (error.code === 'busy') return 'A tip is already being sent. Wait a moment.'
    if (error.status === 402) return 'The payment was not accepted. Check your spending balance and try again.'
    return error.message
  }
  return error instanceof Error ? error.message.split('\n')[0] ?? 'Something went wrong' : 'Something went wrong'
}

export function TipSheet({ open, onClose, videoId, creatorName, onAddFunds }: TipSheetProps) {
  // The form mounts only while the sheet is open, so it starts fresh every time.
  return (
    <Sheet open={open} onClose={onClose} title={`Tip ${creatorName}`}>
      <TipForm onClose={onClose} videoId={videoId} creatorName={creatorName} onAddFunds={onAddFunds} />
    </Sheet>
  )
}

function TipForm({ onClose, videoId, creatorName, onAddFunds }: Omit<TipSheetProps, 'open'>) {
  const { address } = useAccount()
  const { user, signIn, signingIn } = useAuth()
  const { balance, refresh, unlock } = useSpendingWallet()
  const [amount, setAmount] = useState('1')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<bigint | null>(null)

  let micro: bigint | null = null
  try {
    micro = amount ? parseUsdc(amount) : null
  } catch (caught) {
    if (!(caught instanceof AmountError)) throw caught
  }
  const available = balance?.available ?? 0n
  const inRange = micro !== null && micro >= BigInt(MIN_TIP_MICRO) && micro <= BigInt(MAX_TIP_MICRO)
  const afford = micro !== null && micro <= available

  const submit = async () => {
    if (!address || micro === null || !inRange) return
    setSending(true)
    setError(null)
    try {
      const payer = await unlock()
      await sendTip(videoId, { amountMicro: Number(micro), message: message.trim(), payer }, createPaymentScheme(address))
      setSent(micro)
      void refresh()
    } catch (caught) {
      setError(friendly(caught))
    } finally {
      setSending(false)
    }
  }

  const max = available > BigInt(MAX_TIP_MICRO) ? BigInt(MAX_TIP_MICRO) : available

  return (
    <>
      {sent !== null ? (
        <div className="space-y-5 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
            <Check className="size-7" aria-hidden />
          </span>
          <div>
            <p className="text-3xl font-semibold tabular-nums">
              {formatMicro(sent)} <span className="text-base font-medium text-[var(--subtle)]">USDC</span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">went to {creatorName}. Thank you for supporting them.</p>
          </div>
          <Button full shape="rect" className="min-h-11" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-pretty text-sm text-[var(--muted)]">
            A tip goes straight to {creatorName}, on top of what you pay to watch. It is paid from your spending balance.
          </p>
          <AmountInput
            value={amount}
            onChange={setAmount}
            chips={CHIPS}
            disabled={sending}
            balanceLabel={balance ? `Balance ${formatMicro(available)}` : undefined}
            onMax={max > 0n ? () => setAmount(formatUsdc(max)) : undefined}
          />
          <div>
            <label htmlFor="tip-message" className="mb-1.5 flex justify-between text-sm font-medium">
              Add a note <span className="text-xs font-normal text-[var(--subtle)]">Optional</span>
            </label>
            <textarea
              id="tip-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_TIP_MESSAGE_LENGTH}
              rows={2}
              disabled={sending}
              placeholder="Thanks for the video"
              className={inputClass}
            />
            <p className="mt-1 text-right text-[11px] tabular-nums text-[var(--subtle)]">
              {message.length}/{MAX_TIP_MESSAGE_LENGTH}
            </p>
          </div>

          {micro !== null && !inRange && (
            <p className="text-sm text-[var(--warn)]">
              Tips are between {formatMicro(MIN_TIP_MICRO)} and {formatMicro(MAX_TIP_MICRO)} USDC.
            </p>
          )}
          {error && <p className="rounded-lg bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</p>}

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
                    Sign in to tip
                  </Button>
                )
              }
              if (inRange && !afford) {
                return (
                  <Button
                    full
                    shape="rect"
                    className="min-h-12"
                    onClick={() => {
                      onClose()
                      onAddFunds()
                    }}
                  >
                    Add money to tip
                  </Button>
                )
              }
              return (
                <Button full shape="rect" className="min-h-12" loading={sending} disabled={!inRange} onClick={() => void submit()}>
                  {inRange && micro !== null ? `Send ${formatMicro(micro)} USDC` : 'Enter an amount'}
                </Button>
              )
            }}
          </WalletConnect>
        </div>
      )}
    </>
  )
}
