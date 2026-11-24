import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { Button, Sheet } from '@/components/ui/primitives'
import { ARC, GATEWAY_WALLET_ABI, txLink } from '@/lib/arc'
import { useChainData } from '@/hooks/useChainData'
import { formatMicro } from '@/lib/format'
import { AmountError, formatUsdc, parseUsdc } from '@/onchain-money'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'
import { AmountInput } from './AmountInput'

/** On Arc the gas token is USDC too, so Max leaves a little in the wallet to pay the network fee of the two steps. */
const GAS_RESERVE = 100_000n // 0.10 USDC

type Step = 'idle' | 'unlocking' | 'switching' | 'approving' | 'depositing' | 'crediting' | 'done'

const STEP_LABEL: Record<Step, string> = {
  idle: 'Add money',
  unlocking: 'Confirm in your wallet (free)...',
  switching: 'Switch network in your wallet...',
  approving: 'Allow USDC in your wallet...',
  depositing: 'Confirm the deposit in your wallet...',
  crediting: 'Waiting for your balance to update...',
  done: 'Added',
}

function friendly(error: unknown): string | null {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('user rejected') || message.includes('denied')) return null
  if (message.includes('insufficient')) return 'Your wallet does not have enough USDC for that amount.'
  return error instanceof Error ? error.message.split('\n')[0] ?? 'Something went wrong' : 'Something went wrong'
}

export function DepositSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { address, chainId } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient({ chainId: ARC.chainId })
  const { balance, refresh, unlock } = useSpendingWallet()
  const [amount, setAmount] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [hash, setHash] = useState<string | null>(null)

  const chainData = useChainData(address)
  const mainBalance = chainData.balance ?? undefined

  let parsed: bigint | null = null
  try {
    parsed = amount ? parseUsdc(amount) : null
  } catch (error) {
    if (!(error instanceof AmountError)) throw error
  }
  const tooMuch = parsed !== null && mainBalance !== undefined && parsed > mainBalance
  const maxDeposit = mainBalance !== undefined && mainBalance > GAS_RESERVE ? mainBalance - GAS_RESERVE : 0n
  const eatsGas = parsed !== null && mainBalance !== undefined && !tooMuch && parsed > maxDeposit
  const busy = step !== 'idle' && step !== 'done'

  const submit = async () => {
    if (!address || !publicClient || parsed === null || parsed <= 0n) return
    const before = balance?.available ?? 0n
    try {
      // Confirm the spending address first, so the money can never go to an address nobody can sign for.
      setStep('unlocking')
      const spender = await unlock()
      if (chainId !== ARC.chainId) {
        setStep('switching')
        await switchChainAsync({ chainId: ARC.chainId })
      }
      const allowance = await publicClient.readContract({
        address: ARC.usdcAddress,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, ARC.gatewayWallet],
      })
      if (allowance < parsed) {
        setStep('approving')
        const approval = await writeContractAsync({
          address: ARC.usdcAddress,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC.gatewayWallet, parsed],
          chainId: ARC.chainId,
        })
        await publicClient.waitForTransactionReceipt({ hash: approval })
      }
      setStep('depositing')
      const deposit = await writeContractAsync({
        address: ARC.gatewayWallet,
        abi: GATEWAY_WALLET_ABI,
        functionName: 'depositFor',
        args: [ARC.usdcAddress, spender, parsed],
        chainId: ARC.chainId,
      })
      setHash(deposit)
      setStep('crediting')
      const receipt = await publicClient.waitForTransactionReceipt({ hash: deposit })
      if (receipt.status !== 'success') throw new Error('The deposit transaction failed')
      // The balance is credited once Gateway has seen the deposit; poll until it shows up.
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const latest = await refresh()
        if (latest && latest.available > before) break
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
      chainData.refresh()
      setStep('done')
      toast.success('Money added to your spending balance')
    } catch (error) {
      setStep('idle')
      const message = friendly(error)
      if (message) toast.error(message)
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
    <Sheet open={open} onClose={close} title="Add money">
      <div className="space-y-4">
        <p className="text-pretty text-sm text-[var(--muted)]">
          This moves USDC from your wallet into your spending balance. Videos are paid from it, and you can take
          the unused part back any time.
        </p>
        <AmountInput
          value={amount}
          onChange={setAmount}
          chips={['1', '5', '10']}
          disabled={busy}
          balanceLabel={mainBalance !== undefined ? `Wallet: ${formatMicro(mainBalance)}` : 'Wallet balance loading'}
          onMax={maxDeposit > 0n ? () => setAmount(formatUsdc(maxDeposit)) : undefined}
        />
        {tooMuch && <p className="text-sm text-[var(--danger)]">That is more than your wallet holds.</p>}
        {eatsGas && <p className="text-sm text-[var(--warn)]">Leave about 0.10 USDC in your wallet. The network fee is paid in USDC too, and the deposit would fail without it.</p>}
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
            View deposit on the explorer <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </Sheet>
  )
}
