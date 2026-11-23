import { usePrivy } from '@privy-io/react-auth'
import { useDisconnect } from 'wagmi'
import { privyEnabled } from '@/lib/privy'

function useKitDisconnect(): () => void {
  const { disconnect } = useDisconnect()
  return () => disconnect()
}

function usePrivyDisconnect(): () => void {
  const { logout } = usePrivy()
  return () => void logout()
}

/** Ends the wallet connection: a Privy sign-out when Privy is configured, otherwise a plain disconnect. */
export const useWalletDisconnect = privyEnabled ? usePrivyDisconnect : useKitDisconnect
