import { TokenUSDC } from '@web3icons/react'
import { Eye, EyeOff, Nfc } from 'lucide-react'
import { useState } from 'react'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Wordmark } from '@/components/layout/Brand'

interface SpendingCardProps {
  /** Spendable USDC base units, or undefined while it loads. */
  available: bigint | undefined
  loading: boolean
  /** The spending address. Its last four characters stand in for a card number. */
  spender: string | null | undefined
  /** The signed-in person's name, printed as the card holder. */
  holder: string
}

/** The EMV-style chip: gold plate with the usual contact lines. Pure CSS, no image. */
function Chip() {
  return (
    <span
      aria-hidden
      className="relative block h-9 w-12 overflow-hidden rounded-lg border border-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]"
      style={{ background: 'linear-gradient(135deg, #f4dc8a 0%, #c9a24a 45%, #f0d27a 100%)' }}
    >
      <span className="absolute inset-y-0 left-1/3 w-px bg-black/25" />
      <span className="absolute inset-y-0 right-1/3 w-px bg-black/25" />
      <span className="absolute inset-x-0 top-1/2 h-px bg-black/25" />
      <span className="absolute inset-x-[30%] inset-y-[28%] rounded-[3px] border border-black/25" />
    </span>
  )
}

/**
 * The spending balance drawn as a bank card: dark glossy face, chip, contactless mark, the balance where a card
 * number would be, and the spending address ending in place of the digits. Everything shown is real: the balance, the
 * last four characters of the spending address, and the holder's name.
 */
export function SpendingCard({ available, loading, spender, holder }: SpendingCardProps) {
  const [hidden, setHidden] = useState(false)
  const tail = spender ? spender.slice(-4).toUpperCase() : null

  return (
    <div
      className="relative aspect-[1.586/1] w-full max-w-[26rem] select-none overflow-hidden rounded-[22px] border border-white/10 p-5 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.9)] sm:p-6"
      style={{
        background:
          'radial-gradient(90% 120% at 100% 0%, rgba(61,220,87,0.28) 0%, rgba(61,220,87,0) 55%), radial-gradient(80% 90% at 0% 100%, rgba(38,120,255,0.18) 0%, rgba(38,120,255,0) 60%), linear-gradient(135deg, #14231a 0%, #0d1511 55%, #090b0a 100%)',
      }}
      role="group"
      aria-label="Spending card"
    >
      {/* Fine diagonal texture and a soft top sheen, like a printed card. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: 'repeating-linear-gradient(115deg, #fff 0 1px, transparent 1px 9px)' }}
      />
      <span aria-hidden className="pointer-events-none absolute -top-1/2 left-0 h-full w-full -rotate-12 bg-gradient-to-b from-white/10 to-transparent" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            <Wordmark compact />
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">Spending card</p>
          </div>
          <Nfc className="size-6 rotate-90 text-white/70" aria-hidden />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <Chip />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">Balance</p>
              <p className="flex items-baseline gap-1.5 text-[28px] font-semibold leading-8 tabular-nums sm:text-[32px] sm:leading-9">
                {hidden ? '••••••' : available !== undefined ? <AnimatedAmount micro={Number(available)} /> : loading ? '...' : '0.00'}
                <span className="text-sm font-medium text-white/60">USDC</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setHidden((value) => !value)}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
            className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20"
          >
            {hidden ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="mono text-[13px] tracking-[0.22em] text-white/85">
              &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; {tail ?? '----'}
            </p>
            <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">{holder}</p>
          </div>
          {/* Two overlapping discs, the way a card network marks its cards. */}
          <span className="relative flex h-8 w-[3.25rem] shrink-0 items-center" aria-hidden>
            <span className="absolute left-0 size-8 rounded-full bg-[var(--accent)]/85" />
            <span className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-white shadow-md">
              <TokenUSDC variant="branded" size={28} aria-hidden />
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
