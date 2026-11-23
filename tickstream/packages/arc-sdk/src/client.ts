import { buildTxExplorerUrl, getChain, getProtocolContractByName, getUsdc } from '@/onchain-facts'

/** TickStream settles on Arc Testnet. Every fact below comes from the generated onchain-facts module. */
export const ARC_CHAIN_ID = 5042002

export interface ArcNetwork {
  chainId: number
  name: string
  caip2: `${string}:${string}`
  usdcAddress: `0x${string}`
  usdcDecimals: number
  gatewayWallet: `0x${string}`
  rpcUrl: string
}

export function getArcNetwork(): ArcNetwork {
  const chain = getChain(ARC_CHAIN_ID)
  const usdc = getUsdc(ARC_CHAIN_ID)
  const gateway = getProtocolContractByName('GatewayWallet', 'testnet')
  const rpcUrl = chain?.rpcUrls[0]
  if (!chain || !usdc || !gateway || !rpcUrl) {
    throw new Error('Arc Testnet facts are missing from the onchain facts registry')
  }
  return {
    chainId: chain.chainId,
    name: chain.name,
    caip2: `eip155:${chain.chainId}`,
    usdcAddress: usdc.address as `0x${string}`,
    usdcDecimals: usdc.decimals,
    gatewayWallet: gateway.address as `0x${string}`,
    rpcUrl,
  }
}

export function txUrl(hash: string): string {
  return buildTxExplorerUrl(ARC_CHAIN_ID, hash)
}
