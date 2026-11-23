import { GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS } from '@circle-fin/x402-batching/client'
import { BatchFacilitatorClient } from '@circle-fin/x402-batching/server'
import { getArcNetwork } from '../../arc-sdk/src/client'
import { env } from '../../shared/src/env'

type SettleArgs = Parameters<BatchFacilitatorClient['settle']>
export type PaymentPayload = SettleArgs[0]
export type PaymentRequirements = SettleArgs[1]

export interface Authorization {
  from: string
  to: string
  value: string
  validBefore: string
  nonce: string
}

export interface ParsedPayment {
  payload: PaymentPayload
  authorization: Authorization
}

let facilitator: BatchFacilitatorClient | undefined

export function getFacilitator(): BatchFacilitatorClient {
  facilitator ??= new BatchFacilitatorClient({ url: env.gatewayApiUrl() })
  return facilitator
}

/** Payment requirements for one chunk: exact USDC amount, paid straight to the creator's address. */
export function buildRequirements(amountMicro: number, payTo: string): PaymentRequirements {
  const arc = getArcNetwork()
  return {
    scheme: 'exact',
    network: arc.caip2,
    asset: arc.usdcAddress,
    amount: String(amountMicro),
    payTo,
    maxTimeoutSeconds: GATEWAY_AUTH_VALIDITY_WINDOW_SECONDS,
    extra: {
      name: 'GatewayWalletBatched',
      version: '1',
      verifyingContract: arc.gatewayWallet,
    },
  }
}

export function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64')
}

export function buildPaymentRequired(requirements: PaymentRequirements, resourceUrl: string, description: string) {
  return {
    x402Version: 2,
    resource: { url: resourceUrl, description, mimeType: 'application/json' },
    accepts: [requirements],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Decodes the base64 payment header and extracts the EIP-3009 authorization. Returns undefined when malformed. */
export function parsePaymentHeader(header: string): ParsedPayment | undefined {
  try {
    const decoded: unknown = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    if (!isRecord(decoded) || !isRecord(decoded.payload)) return undefined
    const auth = decoded.payload.authorization
    if (!isRecord(auth)) return undefined
    const { from, to, value, validBefore, nonce } = auth
    if (
      typeof from !== 'string' ||
      typeof to !== 'string' ||
      typeof nonce !== 'string' ||
      (typeof value !== 'string' && typeof value !== 'number') ||
      (typeof validBefore !== 'string' && typeof validBefore !== 'number')
    ) {
      return undefined
    }
    return {
      payload: decoded as unknown as PaymentPayload,
      authorization: { from, to, nonce, value: String(value), validBefore: String(validBefore) },
    }
  } catch {
    return undefined
  }
}

export type AuthorizationCheck = { ok: true } | { ok: false; reason: string }

/** Verifies the signed authorization says exactly what the server asked for, before anything is settled. */
export function checkAuthorization(
  auth: Authorization,
  expected: { payer: string; payTo: string; amountMicro: number },
): AuthorizationCheck {
  if (auth.from.toLowerCase() !== expected.payer.toLowerCase()) return { ok: false, reason: 'payer_mismatch' }
  if (auth.to.toLowerCase() !== expected.payTo.toLowerCase()) return { ok: false, reason: 'recipient_mismatch' }
  if (auth.value !== String(expected.amountMicro)) return { ok: false, reason: 'amount_mismatch' }
  if (!/^0x[0-9a-fA-F]{64}$/.test(auth.nonce)) return { ok: false, reason: 'invalid_nonce' }
  return { ok: true }
}

export interface SettleOutcome {
  success: boolean
  transaction: string | null
  errorReason: string | null
}

/** Settles with the requirements the server built, never with the ones the client claims. */
export async function settlePayment(payload: PaymentPayload, requirements: PaymentRequirements): Promise<SettleOutcome> {
  const result = await getFacilitator().settle(payload, requirements)
  return {
    success: result.success === true,
    transaction: typeof result.transaction === 'string' && result.transaction ? result.transaction : null,
    errorReason: typeof result.errorReason === 'string' ? result.errorReason : null,
  }
}
