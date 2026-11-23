import { BatchEvmScheme, GatewayClient } from '@circle-fin/x402-batching/client'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { Hex } from 'viem'
import { ARC } from './arc'

/**
 * The spending wallet is a small signing key kept in this browser, one per connected wallet.
 * It signs payment authorizations silently so playback never stops for a wallet pop-up. Funds
 * sit in the viewer's Gateway balance under this address; the viewer tops it up and withdraws
 * with their main wallet. Keep only what you plan to spend here.
 */
const storageKey = (owner: string) => `tickstream:spending-key:${owner.toLowerCase()}`

export function loadSpendingKey(owner: string): Hex {
  const existing = localStorage.getItem(storageKey(owner))
  if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) return existing as Hex
  const created = generatePrivateKey()
  localStorage.setItem(storageKey(owner), created)
  return created
}

export function getSpendingAccount(owner: string) {
  return privateKeyToAccount(loadSpendingKey(owner))
}

export function createGatewayClient(owner: string): GatewayClient {
  return new GatewayClient({ chain: 'arcTestnet', privateKey: loadSpendingKey(owner), rpcUrl: ARC.rpcUrl })
}

export function createPaymentScheme(owner: string): BatchEvmScheme {
  const account = getSpendingAccount(owner)
  return new BatchEvmScheme({
    address: account.address,
    signTypedData: (params) => account.signTypedData(params),
  })
}
