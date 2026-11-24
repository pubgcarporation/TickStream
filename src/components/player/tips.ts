import type { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { apiRaw, parseError } from '@/lib/api'

type Requirements = Parameters<BatchEvmScheme['createPaymentPayload']>[1]

interface PaymentRequired {
  resource: unknown
  accepts: Requirements[]
}

export interface TipResult {
  amountMicro: number
  transferId: string | null
}

/**
 * Sends a tip over x402, the same way each interval of a video is paid.
 * The server answers 402 with the exact amount and the creator as recipient; the spending wallet signs exactly that.
 */
export async function sendTip(
  videoId: string,
  tip: { amountMicro: number; message: string; payer: string },
  scheme: BatchEvmScheme,
): Promise<TipResult> {
  const body = { payer: tip.payer, amountMicro: tip.amountMicro, ...(tip.message ? { message: tip.message } : {}) }
  const first = await apiRaw(`videos/${videoId}/tip`, { method: 'POST', body })
  if (first.ok) return (await first.json()) as TipResult
  if (first.status !== 402) throw await parseError(first)

  const required = ((await first.json()) as { paymentRequired?: PaymentRequired }).paymentRequired
  const option = required?.accepts[0]
  if (!required || !option) throw new Error('The server did not return a payment option')

  const payload = await scheme.createPaymentPayload(2, option)
  const payment = btoa(JSON.stringify({ ...payload, resource: required.resource, accepted: option }))
  const second = await apiRaw(`videos/${videoId}/tip`, { method: 'POST', body: { ...body, payment } })
  if (!second.ok) throw await parseError(second)
  return (await second.json()) as TipResult
}
