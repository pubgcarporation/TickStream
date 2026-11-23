import { buildAddressExplorerUrl, buildTxExplorerUrl, getChain, getProtocolContractByName, getUsdc } from '@/onchain-facts'

export const ARC_CHAIN_ID = 5042002

const chain = getChain(ARC_CHAIN_ID)
const usdc = getUsdc(ARC_CHAIN_ID)
const gatewayWallet = getProtocolContractByName('GatewayWallet', 'testnet')
const rpcUrl = chain?.rpcUrls[0]

if (!chain || !usdc || !gatewayWallet || !rpcUrl) {
  throw new Error('Arc Testnet facts are missing from the onchain registry')
}

export const ARC = {
  chainId: chain.chainId,
  name: chain.name,
  usdcAddress: usdc.address as `0x${string}`,
  gatewayWallet: gatewayWallet.address as `0x${string}`,
  rpcUrl,
}

export const txLink = (hash: string) => buildTxExplorerUrl(ARC_CHAIN_ID, hash)
export const addressLink = (address: string) => buildAddressExplorerUrl(ARC_CHAIN_ID, address)

export const GATEWAY_WALLET_ABI = [
  {
    name: 'depositFor',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'depositor', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
] as const
