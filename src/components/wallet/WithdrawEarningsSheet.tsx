import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { useAccount, usePublicClient, useSignTypedData, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import type { Hex } from 'viem'
import { Button, Sheet } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { ARC, txLink } from '@/lib/arc'
import { formatMicro } from '@/lib/format'
import {
  BURN_INTENT_TYPES,
  GATEWAY_MINTER,
  GATEWAY_MINTER_ABI,
  WITHDRAW_DOMAIN,
  bigintReplacer,
  buildBurnIntent,
} from '@/lib/gateway-withdraw'
import { AmountError, formatUsdc, parseUsdc } from '@/onchain-money'
import { AmountInput } from './AmountInput'

type Step = 'idle' | 'signing' | 'approving' | 'switching' | 'minting' | 'done'

const LABEL: Record<Step, string> = {
  idle: 'Withdraw to my wallet',
  signing: 'Sign the withdrawal in your wallet...',
  approving: 'Gateway is approving...',
  switching: 'Switch network in your wallet...',
  minting: 'Confirm the final step in your wallet...',
  done: 'Withdrawn',
}

interface RelayResult {
  attestation: Hex
  signature: Hex
}

export function WithdrawEarningsSheet({
  open,
  onClose,
  available,
  onDone,
}: {
  open: boolean
  onClose: () => void
  available: bigint
  onDone: () => void
}) {
  const { address, chainId } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ARC.chainId })
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [hash, setHash] = useState<string | null>(null)

  let parsed: bigint | null = null
  try {
    parsed = amount ? parseUsdc(amount) : null
  } catch (error) {
    if (!(error instanceof AmountError)) throw error
  }
  const tooMuch = parsed !== null && parsed > available
  const busy = step !== 'idle' && step !== 'done'

  const submit = async () => {
    if (!address || !publicClient || parsed === null || parsed <= 0n) return
    try {
      setStep('signing')
      const burnIntent = buildBurnIntent(address, address, parsed)
      const signature = await signTypedDataAsync({
        domain: WITHDRAW_DOMAIN,
        types: BURN_INTENT_TYPES,
        primaryType: 'BurnIntent',
        message: burnIntent,
      })
      setStep('approving')
      const relayed = await api<RelayResult>('creator/withdraw/relay', {
        method: 'POST',
        body: JSON.parse(JSON.stringify({ burnIntent, signature }, bigintReplacer)) as Record<string, unknown>,
      })
      if (chainId !== ARC.chainId) {
        setStep('switching')
        await switchChainAsync({ chainId: ARC.chainId })
      }
      setStep('minting')
      const mint = await writeContractAsync({
        address: GATEWAY_MINTER,
        abi: GATEWAY_MINTER_ABI,
        functionName: 'gatewayMint',
        args: [relayed.attestation, relayed.signature],
        chainId: ARC.chainId,
      })
      setHash(mint)
      const receipt = await publicClient.waitForTransactionReceipt({ hash: mint })
      if (receipt.status !== 'success') throw new Error('The final transfer failed')
      setStep('done')
      onDone()
      toast.success('Earnings sent to your wallet')
    } catch (error) {
      setStep('idle')
      const message = error instanceof Error ? error.message : ''
      if (!message.toLowerCase().includes('user rejected') && !message.toLowerCase().includes('denied')) {
        toast.error(message.split('\n')[0] || 'Could not withdraw')
      }
    }
  }

  const close = () => {
    if (busy) return
    setStep('idle')
    setHash(null)
    setAmount('')
    onClose()
  }

  return (
    <Sheet open={open} onClose={close} title="Withdraw earnings">
      <div className="space-y-4">
        <p className="text-pretty text-sm text-[var(--muted)]">
          Move USDC from your payout balance to your connected wallet. You sign once to authorize it, then confirm a final transfer. Gateway
          takes a small fee from your balance, so leave a little room if you withdraw everything.
        </p>
        <AmountInput
          value={amount}
          onChange={setAmount}
          disabled={busy}
          balanceLabel={`Available: ${formatMicro(available)}`}
          onMax={available > 0n ? () => setAmount(formatUsdc(available)) : undefined}
        />
        {tooMuch && <p className="text-sm text-[var(--danger)]">That is more than your available balance.</p>}
        {step === 'done' ? (
          <Button full onClick={close}>
            Done
          </Button>
        ) : (
          <Button full loading={busy} disabled={!parsed || parsed <= 0n || tooMuch || !address} onClick={() => void submit()}>
            {LABEL[step]}
          </Button>
        )}
        {hash && (
          <a href={txLink(hash)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--accent)]">
            View transfer on the explorer <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </Sheet>
  )
}
