import { BatchEvmScheme, GatewayClient } from '@circle-fin/x402-batching/client'
import { concat, getAddress, keccak256, toBytes, type Address, type Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { ARC } from './arc'

/**
 * The spending wallet is a signing key that pays for video and tips without a wallet pop-up per payment.
 * Funds sit in the viewer's Circle Gateway balance under this key's address.
 *
 * How the key is kept:
 * - derived (default): the key is computed from a signature by the user's main wallet over a fixed message. It is
 *   never written to disk. It lives in memory for the tab, and the same key comes back on any device.
 * - stored (older keys, or wallets whose signatures are not repeatable): a random key kept in this browser's storage.
 *
 * The first time a derived key is made, the wallet signs twice and both signatures must match. A wallet that signs
 * differently each time (some smart-contract wallets) would give a different key on every visit and strand funds,
 * so it falls back to a stored key instead.
 */

export type KeyMode = 'derived' | 'stored'

export interface SpendingIdentity {
  address: Address
  mode: KeyMode
}

export type Signer = (message: string) => Promise<Hex>

const legacyKeyName = (owner: string) => `tickstream:spending-key:${owner.toLowerCase()}`
const identityName = (owner: string) => `tickstream:spender:v2:${owner.toLowerCase()}`
const DERIVATION_TAG = 'tickstream-spending-key-v1'

/** Keys that are unlocked for this tab. Memory only, gone when the tab closes. */
const unlocked = new Map<string, Hex>()

export class SpendingKeyError extends Error {
  constructor(
    message: string,
    readonly code: 'locked' | 'mismatch' | 'rejected',
  ) {
    super(message)
    this.name = 'SpendingKeyError'
  }
}

export function unlockMessage(owner: string): string {
  return [
    'TickStream spending wallet',
    '',
    'Sign to unlock the key that pays for videos. This is free, sends no funds and costs no gas.',
    'Only sign this on TickStream.',
    '',
    `Wallet: ${owner.toLowerCase()}`,
    'Version: 1',
  ].join('\n')
}

export function deriveKey(signature: Hex): Hex {
  return keccak256(concat([toBytes(DERIVATION_TAG), toBytes(signature)]))
}

const addressOf = (key: Hex): Address => privateKeyToAccount(key).address

function isKey(value: string | null): value is Hex {
  return Boolean(value && /^0x[0-9a-fA-F]{64}$/.test(value))
}

export function legacyKeyOf(owner: string): Hex | null {
  const value = localStorage.getItem(legacyKeyName(owner))
  return isKey(value) ? value : null
}

/** The spending address already verified for this wallet, if any. Public data, safe to keep. */
export function readIdentity(owner: string): SpendingIdentity | null {
  try {
    const raw = localStorage.getItem(identityName(owner))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SpendingIdentity>
      if (parsed.address && (parsed.mode === 'derived' || parsed.mode === 'stored')) return { address: getAddress(parsed.address), mode: parsed.mode }
    }
  } catch {
    // fall through to the older key
  }
  // Older versions only kept the key. Its address is what the balance was deposited under.
  const legacy = legacyKeyOf(owner)
  return legacy ? { address: addressOf(legacy), mode: 'stored' } : null
}

function writeIdentity(owner: string, identity: SpendingIdentity): void {
  localStorage.setItem(identityName(owner), JSON.stringify(identity))
}

export function isUnlocked(owner: string): boolean {
  return unlocked.has(owner.toLowerCase())
}

export function lockSpendingKey(owner?: string): void {
  if (owner) unlocked.delete(owner.toLowerCase())
  else unlocked.clear()
}

function requireKey(owner: string): Hex {
  const key = unlocked.get(owner.toLowerCase())
  if (!key) throw new SpendingKeyError('Unlock your spending wallet first', 'locked')
  return key
}

/** Reads balances for any address. Uses a throwaway key, so no real key is needed to look. */
export function createReadOnlyGatewayClient(): GatewayClient {
  return new GatewayClient({ chain: 'arcTestnet', privateKey: generatePrivateKey(), rpcUrl: ARC.rpcUrl })
}

export function createGatewayClient(owner: string): GatewayClient {
  return new GatewayClient({ chain: 'arcTestnet', privateKey: requireKey(owner), rpcUrl: ARC.rpcUrl })
}

export function createPaymentScheme(owner: string): BatchEvmScheme {
  const account = privateKeyToAccount(requireKey(owner))
  return new BatchEvmScheme({
    address: account.address,
    signTypedData: (params) => account.signTypedData(params),
  })
}

function isRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('user rejected') || message.includes('denied') || message.includes('rejected') || message.includes('cancel')
}

/** Signs the unlock message twice and returns the key only when both signatures are identical. */
async function deriveVerified(owner: string, sign: Signer): Promise<Hex | null> {
  const message = unlockMessage(owner)
  const first = await sign(message)
  const second = await sign(message)
  return first === second ? deriveKey(first) : null
}

/** True when nothing is left under this address, so its key is safe to forget. */
async function isEmpty(address: Address): Promise<boolean> {
  const balances = await createReadOnlyGatewayClient().getBalances(address)
  return balances.gateway.total === 0n && balances.wallet.balance === 0n
}

async function hasNoGatewayFunds(address: Address): Promise<boolean> {
  const balances = await createReadOnlyGatewayClient().getBalances(address)
  return balances.gateway.total === 0n
}

/**
 * Makes the spending key available for this tab and returns its verified address.
 * May ask the main wallet to sign (free, no gas). Never touches funds.
 */
export async function unlockSpendingKey(owner: string, sign: Signer): Promise<SpendingIdentity> {
  const cached = unlocked.get(owner.toLowerCase())
  const known = readIdentity(owner)
  if (cached && known) return { address: addressOf(cached), mode: known.mode }

  const legacy = legacyKeyOf(owner)

  // A stored key that still holds money keeps working. It moves to a derived key once it is empty.
  if (known?.mode === 'stored' && legacy) {
    let funded = true
    try {
      funded = !(await hasNoGatewayFunds(addressOf(legacy)))
    } catch {
      funded = true
    }
    if (funded) {
      unlocked.set(owner.toLowerCase(), legacy)
      return { address: addressOf(legacy), mode: 'stored' }
    }
  }

  // Returning derived user: one signature, and it has to give back the same address as before.
  if (known?.mode === 'derived') {
    let signature: Hex
    try {
      signature = await sign(unlockMessage(owner))
    } catch (error) {
      throw isRejection(error) ? new SpendingKeyError('Signing was cancelled', 'rejected') : error
    }
    const key = deriveKey(signature)
    if (addressOf(key) !== known.address) {
      throw new SpendingKeyError(
        'Your wallet signed differently than before, so the spending address would change. Nothing was moved. Try again or use the wallet you first signed in with.',
        'mismatch',
      )
    }
    unlocked.set(owner.toLowerCase(), key)
    return known
  }

  // First time (or an empty stored key): make a derived key, after proving the wallet signs repeatably.
  let derived: Hex | null
  try {
    derived = await deriveVerified(owner, sign)
  } catch (error) {
    throw isRejection(error) ? new SpendingKeyError('Signing was cancelled', 'rejected') : error
  }

  if (derived) {
    const identity: SpendingIdentity = { address: addressOf(derived), mode: 'derived' }
    unlocked.set(owner.toLowerCase(), derived)
    writeIdentity(owner, identity)
    // Forget the old plain-text key only when nothing is left under it.
    if (legacy) {
      try {
        if (await isEmpty(addressOf(legacy))) localStorage.removeItem(legacyKeyName(owner))
      } catch {
        // Keep it. Safer to leave an old key than to lose one that may hold money.
      }
    }
    return identity
  }

  // The wallet signs differently each time, so a derived key is not possible. Fall back to a stored key.
  const stored = legacy ?? generatePrivateKey()
  if (!legacy) localStorage.setItem(legacyKeyName(owner), stored)
  const identity: SpendingIdentity = { address: addressOf(stored), mode: 'stored' }
  writeIdentity(owner, identity)
  unlocked.set(owner.toLowerCase(), stored)
  return identity
}

/** The old plain-text key, for the one case where it still exists. */
export function revealLegacyKey(owner: string): Hex | null {
  return legacyKeyOf(owner)
}
