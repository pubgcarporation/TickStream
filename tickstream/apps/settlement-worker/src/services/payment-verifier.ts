import { env } from '@shared/env'

export type GatewayTransferStatus = 'received' | 'batched' | 'confirmed' | 'completed' | 'failed' | 'unknown'

/** Gateway asked us to slow down. The worker stops checking for the rest of the cycle. */
export class GatewayBusyError extends Error {
  constructor() {
    super('Gateway is rate limiting status checks')
    this.name = 'GatewayBusyError'
  }
}

/** Looks up one nanopayment transfer in Circle Gateway. Returns 'unknown' if the lookup itself fails. */
export async function fetchTransferStatus(transferId: string): Promise<GatewayTransferStatus> {
  const response = await fetch(`${env.gatewayApiUrl()}/v1/x402/transfers/${encodeURIComponent(transferId)}`, {
    signal: AbortSignal.timeout(10_000),
  })
  if (response.status === 429) throw new GatewayBusyError()
  if (!response.ok) return 'unknown'
  const data = (await response.json()) as { status?: string }
  switch (data.status) {
    case 'received':
    case 'batched':
    case 'confirmed':
    case 'completed':
    case 'failed':
      return data.status
    default:
      return 'unknown'
  }
}
