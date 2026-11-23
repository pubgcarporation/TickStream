/**
 * wagmi configuration
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { createConfig as createPrivyConfig } from '@privy-io/wagmi'
import { privyEnabled } from './lib/privy'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])

const chains = [arcTestnet, mainnet] as const // mainnet needed for ENS resolution
const transports = {
  [arcTestnet.id]: http(),
  [mainnet.id]: http(), // ENS resolution uses mainnet
}

// With Privy, the login service drives which wallet is connected, so no connectors are listed here.
export const config = privyEnabled
  ? createPrivyConfig({ chains, transports })
  : createConfig({ chains, connectors: [injected()], transports })
