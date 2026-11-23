import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { Button, Sheet } from '@/components/ui/primitives'
import { ARC, txLink } from '@/lib/arc'
import { formatMicro } from '@/lib/format'
import { createGatewayClient } from '@/lib/spending-wallet'
import { AmountError, formatUsdc, parseUsdc } from '@/onchain-money'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'
import { AmountInput } from './AmountInput'

type Step = 'idle' | 'switching' | 'gas' | 'withdrawing' | 'done'

const STEP_LABEL: Record<Step, string> = {
  idle: 'Move to my wallet',
  switching: 'Switch network in your wallet...',
  gas: 'Confirm the network fee top-up in your wallet...',
  withdrawing: 'Moving your money...',
  done: 'Moved',
}

// The spending address submits the final transfer itself, so it needs a small amount of USDC for network fees.
const GAS_FLOOR = parseUsdc('0.05')
const GAS_TOPUP = parseUsdc('0.10')

export function WithdrawSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ARC.chainId })
  const { spender, balance, refresh } = useSpendingWallet()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [hash, setHash] = useState<string | null>(null)

  let parsed: bigint | null = null
  try {
    parsed = amount ? parseUsdc(amount) : null
  } catch (error) {
    if (!(error instanceof AmountError)) throw error
  }
  const available = balance?.available ?? 0n
  const tooMuch = parsed !== null && parsed > available
  const busy = step !== 'idle' && step !== 'done'

  const submit = async () => {
    if (!address || !spender || !publicClient || parsed === null || parsed <= 0n) return
    try {
      const client = createGatewayClient(address)
      const balances = await client.getBalances()
      if (balances.wallet.balance < GAS_FLOOR) {
        if (chainId !== ARC.chainId) {
          setStep('switching')
          await switchChainAsync({ chainId: ARC.chainId })
        }
        setStep('gas')
        const topUp = await writeContractAsync({
          address: ARC.usdcAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [spender, GAS_TOPUP],
          chainId: ARC.chainId,
        })
        await publicClient.waitForTransactionReceipt({ hash: topUp })
      }
      setStep('withdrawing')
      const result = await client.withdraw(formatUsdc(parsed), { recipient: address })
      setHash(result.mintTxHash)
      await refresh()
      setStep('done')
      toast.success('Money moved back to your wallet')
    } catch (error) {
      setStep('idle')
      const message = error instanceof Error ? error.message.toLowerCase() : ''
      if (!message.includes('user rejected') && !message.includes('denied')) {
        toast.error(error instanceof Error ? error.message.split('\n')[0] ?? 'Could not move your money' : 'Could not move your money')
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
    <Sheet open={open} onClose={close} title="Move money back">
      <div className="space-y-4">
        <p className="text-pretty text-sm text-[var(--muted)]">
          Send unused spending balance back to your connected wallet. A small network fee applies, and the first time
          you may be asked to confirm a one-off 0.10 USDC top-up so your spending address can pay it.
        </p>
        <AmountInput
          value={amount}
          onChange={setAmount}
          disabled={busy}
          balanceLabel={`Spending balance: ${formatMicro(available)}`}
          onMax={available > 0n ? () => setAmount(formatUsdc(available)) : undefined}
        />
        {tooMuch && <p className="text-sm text-[var(--danger)]">That is more than your spending balance.</p>}
        {step === 'done' ? (
          <Button full onClick={close}>
            Done
          </Button>
        ) : (
          <Button full loading={busy} disabled={!parsed || parsed <= 0n || tooMuch || !address} onClick={() => void submit()}>
            {STEP_LABEL[step]}
          </Button>
        )}
        {hash && (
          <a
            href={txLink(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--accent)]"
          >
            View transfer on the explorer <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </Sheet>
  )
}
