import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { ConnectKitProvider } from 'connectkit'
import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { config } from '@/config'
import { PRIVY_APP_ID, privyEnabled } from '@/lib/privy'

const queryClient = new QueryClient()

/** Wallet, data and login providers. Uses Privy when an app ID is configured, otherwise plain wallet connection. */
export function WalletProviders({ children }: { children: ReactNode }) {
  if (privyEnabled && PRIVY_APP_ID) {
    return (
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['email', 'google', 'wallet'],
          appearance: { theme: 'dark', accentColor: '#acc6e9', showWalletLoginFirst: false },
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          defaultChain: arcTestnet,
          supportedChains: [arcTestnet, mainnet],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={config}>{children}</PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    )
  }
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
