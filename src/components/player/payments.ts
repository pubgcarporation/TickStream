import type { SessionInfo } from '@shared/types'
import type { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { api, ApiError, apiRaw, parseError } from '@/lib/api'

type Requirements = Parameters<BatchEvmScheme['createPaymentPayload']>[1]

interface PaymentRequired {
  resource: unknown
  accepts: Requirements[]
}

export interface GrantResponse {
  session: SessionInfo
  amountMicro: number
  transferId: string | null
  complete?: boolean
}

/**
 * Pays for the next chunk of a session over x402.
 * 1. Ask for the chunk. The server answers 402 with the exact price and recipient.
 * 2. Sign that exact amount with the spending wallet and send it back.
 * The server settles it with Gateway and only then unlocks the segments.
 */
export async function payNextChunk(sessionId: string, scheme: BatchEvmScheme): Promise<GrantResponse> {
  const first = await apiRaw(`sessions/${sessionId}/grant`, { method: 'POST', body: {} })
  if (first.ok) return (await first.json()) as GrantResponse
  if (first.status !== 402) throw await parseError(first)

  const body = (await first.json()) as { paymentRequired?: PaymentRequired }
  const required = body.paymentRequired
  const option = required?.accepts[0]
  if (!required || !option) throw new Error('The server did not return a payment option')

  const payload = await scheme.createPaymentPayload(2, option)
  const payment = btoa(JSON.stringify({ ...payload, resource: required.resource, accepted: option }))
  const second = await apiRaw(`sessions/${sessionId}/grant`, { method: 'POST', body: { payment } })
  if (!second.ok) throw await parseError(second)
  return (await second.json()) as GrantResponse
}

export function isFundsError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  const text = `${error.code ?? ''} ${error.message}`.toLowerCase()
  return error.status === 402 && (text.includes('insufficient') || text.includes('balance') || text.includes('funds'))
}

export function endSessionKeepalive(sessionId: string, token: string | null, second?: number): void {
  if (!token) return
  if (second !== undefined) {
    void fetch(`/api/sessions/${sessionId}/position`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ second: Math.max(0, Math.floor(second)) }),
      keepalive: true,
    }).catch(() => undefined)
  }
  void fetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    keepalive: true,
  }).catch(() => undefined)
}

export async function seekSession(sessionId: string, second: number): Promise<{ session: SessionInfo; reset: boolean }> {
  return api<{ session: SessionInfo; reset: boolean }>(`sessions/${sessionId}/seek`, {
    method: 'POST',
    body: { second: Math.max(0, Math.floor(second)) },
  })
}
