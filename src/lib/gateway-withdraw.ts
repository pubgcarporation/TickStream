import { GATEWAY_DOMAINS } from '@circle-fin/x402-batching/client'
import { getProtocolContractByName } from '@/onchain-facts'
import { maxUint256, pad, toHex, zeroAddress, type Hex } from 'viem'
import { ARC } from './arc'

export const GATEWAY_MINTER_ABI = [
  {
    name: 'gatewayMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'attestationPayload', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const

const minter = getProtocolContractByName('GatewayMinter', 'testnet')
if (!minter) throw new Error('Gateway minter address is missing from the onchain registry')
export const GATEWAY_MINTER = minter.address as `0x${string}`

/** Upper bound on the Gateway fee a withdrawal accepts, in USDC base units (2.01 USDC, the SDK default). */
export const MAX_WITHDRAW_FEE = 2_010_000n

export const WITHDRAW_DOMAIN = { name: 'GatewayWallet', version: '1' } as const

export const BURN_INTENT_TYPES = {
  TransferSpec: [
    { name: 'version', type: 'uint32' },
    { name: 'sourceDomain', type: 'uint32' },
    { name: 'destinationDomain', type: 'uint32' },
    { name: 'sourceContract', type: 'bytes32' },
    { name: 'destinationContract', type: 'bytes32' },
    { name: 'sourceToken', type: 'bytes32' },
    { name: 'destinationToken', type: 'bytes32' },
    { name: 'sourceDepositor', type: 'bytes32' },
    { name: 'destinationRecipient', type: 'bytes32' },
    { name: 'sourceSigner', type: 'bytes32' },
    { name: 'destinationCaller', type: 'bytes32' },
    { name: 'value', type: 'uint256' },
    { name: 'salt', type: 'bytes32' },
    { name: 'hookData', type: 'bytes' },
  ],
  BurnIntent: [
    { name: 'maxBlockHeight', type: 'uint256' },
    { name: 'maxFee', type: 'uint256' },
    { name: 'spec', type: 'TransferSpec' },
  ],
} as const

const toBytes32 = (address: string): Hex => pad(address.toLowerCase() as Hex, { size: 32 })

/** A same-chain withdrawal from Gateway back to `recipient` on Arc Testnet. */
export function buildBurnIntent(depositor: string, recipient: string, value: bigint) {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const domain = GATEWAY_DOMAINS.arcTestnet
  return {
    maxBlockHeight: maxUint256,
    maxFee: MAX_WITHDRAW_FEE,
    spec: {
      version: 1,
      sourceDomain: domain,
      destinationDomain: domain,
      sourceContract: toBytes32(ARC.gatewayWallet),
      destinationContract: toBytes32(GATEWAY_MINTER),
      sourceToken: toBytes32(ARC.usdcAddress),
      destinationToken: toBytes32(ARC.usdcAddress),
      sourceDepositor: toBytes32(depositor),
      destinationRecipient: toBytes32(recipient),
      sourceSigner: toBytes32(depositor),
      destinationCaller: toBytes32(zeroAddress),
      value,
      salt,
      hookData: '0x' as Hex,
    },
  }
}

/** JSON.stringify that writes bigint values as decimal strings, as the Gateway API expects. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value
}
