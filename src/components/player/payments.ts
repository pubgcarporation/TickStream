import type { SessionInfo } from '@shared/types'
import type { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { api, ApiError, apiRaw, apiUrl, parseError } from '@/lib/api'

type Requirements = Parameters<BatchEvmScheme['createPaymentPayload']>[1]

interface PaymentRequired {
  resource: unknown
  accepts: Requirements[]
}

export interface GrantResponse {
  session: SessionInfo
  amountMicro: number
  /** How many segments this payment bought. */
  segments?: number
  transferId: string | null
  complete?: boolean
  /** The price of the following payment. Lets the next payment go out as one request. */
  nextPaymentRequired?: PaymentRequired | null
}

/** The next payment's price per session, from the last successful payment. Used once, then replaced. */
const nextRequired = new Map<string, { required: PaymentRequired; segments: number }>()

export function forgetNextPayment(sessionId: string): void {
  nextRequired.delete(sessionId)
}

async function signAndSend(sessionId: string, scheme: BatchEvmScheme, required: PaymentRequired, segments: number): Promise<Response> {
  const option = required.accepts[0]
  if (!option) throw new Error('The server did not return a payment option')
  const payload = await scheme.createPaymentPayload(2, option)
  const payment = btoa(JSON.stringify({ ...payload, resource: required.resource, accepted: option }))
  return apiRaw(`sessions/${sessionId}/grant`, { method: 'POST', body: { payment, segments } })
}

function remember(sessionId: string, result: GrantResponse, segments: number): GrantResponse {
  if (result.nextPaymentRequired) nextRequired.set(sessionId, { required: result.nextPaymentRequired, segments })
  else nextRequired.delete(sessionId)
  return result
}

/**
 * Pays for the next chunk of a session over x402.
 * Fast path: the last payment returned the next price, so one signed request is enough.
 * Otherwise: ask for the chunk, the server answers 402 with the exact price and recipient, then sign and send.
 * Either way the server checks the amount, recipient and payer itself and settles with Gateway before unlocking.
 */
export async function payNextChunk(sessionId: string, scheme: BatchEvmScheme, segments = 1): Promise<GrantResponse> {
  // The saved price only fits a payment of the same size, so a different size asks the server again.
  const saved = nextRequired.get(sessionId)
  nextRequired.delete(sessionId)
  const cached = saved && saved.segments === segments ? saved.required : undefined
  if (cached) {
    const fast = await signAndSend(sessionId, scheme, cached, segments)
    if (fast.ok) return remember(sessionId, (await fast.json()) as GrantResponse, segments)
    const failure = await parseError(fast)
    // Only a price that changed (for example after a seek) is retried. Nothing was settled in that case.
    if (failure.code !== 'amount_mismatch') throw failure
  }

  const first = await apiRaw(`sessions/${sessionId}/grant`, { method: 'POST', body: { segments } })
  if (first.ok) return remember(sessionId, (await first.json()) as GrantResponse, segments)
  if (first.status !== 402) throw await parseError(first)

  const body = (await first.json()) as { paymentRequired?: PaymentRequired }
  if (!body.paymentRequired) throw new Error('The server did not return a payment option')
  const second = await signAndSend(sessionId, scheme, body.paymentRequired, segments)
  if (!second.ok) throw await parseError(second)
  return remember(sessionId, (await second.json()) as GrantResponse, segments)
}

export function isFundsError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase()
  return error.status === 402 && (text.includes('insufficient') || text.includes('balance') || text.includes('funds'))
}

export function endSessionKeepalive(sessionId: string, token: string | null, second?: number): void {
  if (!token) return
  // One request ends the session and saves the position, so the two can never arrive out of order.
  void fetch(apiUrl(`sessions/${sessionId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ second: Math.max(0, Math.floor(second ?? 0)) }),
    keepalive: true,
  }).catch(() => undefined)
}

export async function seekSession(sessionId: string, second: number): Promise<{ session: SessionInfo; reset: boolean }> {
  return api<{ session: SessionInfo; reset: boolean }>(`sessions/${sessionId}/seek`, {
    method: 'POST',
    body: { second: Math.max(0, Math.floor(second)) },
  })
}
