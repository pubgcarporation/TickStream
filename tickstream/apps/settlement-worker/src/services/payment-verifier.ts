import { env } from '@shared/env'

export type GatewayTransferStatus = 'received' | 'batched' | 'confirmed' | 'completed' | 'failed' | 'unknown'

/** Looks up one nanopayment transfer in Circle Gateway. Returns 'unknown' if the lookup itself fails. */
export async function fetchTransferStatus(transferId: string): Promise<GatewayTransferStatus> {
  const response = await fetch(`${env.gatewayApiUrl()}/v1/x402/transfers/${encodeURIComponent(transferId)}`)
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
