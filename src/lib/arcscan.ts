import { getChain, getProtocolContractByName, getUsdc } from '@/onchain-facts'

/**
 * Reads onchain data from the Arcscan explorer API (Blockscout v2). It lists history and balances in one request each.
 * Writes, allowances and receipts stay on the RPC, which is the source of truth for sending transactions.
 *
 * Every function here is plain `fetch`, so it runs the same in a Web Worker and on the page.
 */

const ARC_CHAIN_ID = 5042002

const chain = getChain(ARC_CHAIN_ID)
const usdc = getUsdc(ARC_CHAIN_ID)
const gatewayWallet = getProtocolContractByName('GatewayWallet', 'testnet')
const gatewayMinter = getProtocolContractByName('GatewayMinter', 'testnet')

if (!chain?.explorerBase || !usdc || !gatewayWallet || !gatewayMinter) {
  throw new Error('Arc Testnet explorer facts are missing from the onchain registry')
}

const API = `${chain.explorerBase.replace(/\/+$/, '')}/api/v2`
const USDC = usdc.address.toLowerCase()
const GATEWAY_WALLET = gatewayWallet.address.toLowerCase()
const GATEWAY_MINTER = gatewayMinter.address.toLowerCase()
const ZERO = '0x0000000000000000000000000000000000000000'

export class ArcscanError extends Error {
  constructor(
    message: string,
    /** Seconds to wait before asking again, when the API said so. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message)
    this.name = 'ArcscanError'
  }
}

export type ActivityKind = 'deposit' | 'withdrawal' | 'received' | 'sent'

export interface ActivityItem {
  hash: string
  kind: ActivityKind
  /** USDC base units (6 decimals), as a decimal string so it can cross a worker boundary. */
  amount: string
  counterparty: string
  timestamp: string
}

export interface ChainSnapshot {
  address: string
  /** USDC base units (ERC-20 view, 6 decimals), as a decimal string. */
  balance: string
  activity: ActivityItem[]
  at: number
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } })
  if (response.status === 429) {
    const reset = Number(response.headers.get('x-ratelimit-reset'))
    // The reset header is in milliseconds on this API. Fall back to a few seconds if it is missing.
    const wait = Number.isFinite(reset) && reset > 0 ? Math.ceil(reset / 1000) : 5
    throw new ArcscanError('Arcscan is rate limiting requests', Math.min(Math.max(wait, 2), 60))
  }
  if (!response.ok) throw new ArcscanError(`Arcscan answered ${response.status}`)
  return response.json()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** The USDC balance in the ERC-20 view (6 decimals). It is the same pool the native balance shows on Arc. */
export async function fetchUsdcBalance(address: string): Promise<bigint> {
  const data = await getJson(`/addresses/${address}/token-balances`)
  if (!Array.isArray(data)) throw new ArcscanError('Unexpected balance reply')
  for (const entry of data) {
    if (!isRecord(entry) || !isRecord(entry.token)) continue
    if (str(entry.token.address_hash).toLowerCase() !== USDC) continue
    if (str(entry.token.decimals) !== '6') throw new ArcscanError('Unexpected USDC decimals')
    return BigInt(str(entry.value) || '0')
  }
  return 0n
}

function toActivity(address: string, raw: unknown): ActivityItem | null {
  if (!isRecord(raw) || !isRecord(raw.from) || !isRecord(raw.to) || !isRecord(raw.total)) return null
  const me = address.toLowerCase()
  const from = str(raw.from.hash).toLowerCase()
  const to = str(raw.to.hash).toLowerCase()
  const hash = str(raw.transaction_hash)
  const value = str(raw.total.value)
  if (!hash || !value || (from !== me && to !== me)) return null

  const method = str(raw.method).toLowerCase()
  const outgoing = from === me
  let kind: ActivityKind
  if (outgoing && to === GATEWAY_WALLET) kind = 'deposit'
  else if (!outgoing && from === ZERO && (method.includes('mint') || str(raw.type) === 'token_minting')) kind = 'withdrawal'
  else if (!outgoing && from === GATEWAY_MINTER) kind = 'withdrawal'
  else kind = outgoing ? 'sent' : 'received'

  return { hash, kind, amount: value, counterparty: outgoing ? to : from, timestamp: str(raw.timestamp) }
}

/** The latest USDC movements for an address: sends, receipts, Gateway deposits and withdrawals. */
export async function fetchActivity(address: string, limit = 12): Promise<ActivityItem[]> {
  const data = await getJson(`/addresses/${address}/token-transfers?type=ERC-20&token=${usdc?.address ?? ''}`)
  if (!isRecord(data) || !Array.isArray(data.items)) throw new ArcscanError('Unexpected activity reply')
  const seen = new Set<string>()
  const items: ActivityItem[] = []
  for (const raw of data.items) {
    const item = toActivity(address, raw)
    if (!item) continue
    const key = `${item.hash}:${item.kind}:${item.amount}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length >= limit) break
  }
  return items
}

export async function fetchSnapshot(address: string): Promise<ChainSnapshot> {
  // Two small requests at the same time, so the page waits for the slower one and not for both in turn.
  const [balance, activity] = await Promise.all([fetchUsdcBalance(address), fetchActivity(address)])
  return { address: address.toLowerCase(), balance: balance.toString(), activity, at: Date.now() }
}
