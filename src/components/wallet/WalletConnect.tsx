import { usePrivy } from '@privy-io/react-auth'
import { ConnectKitButton } from 'connectkit'
import { Copy, LogOut } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAccount } from 'wagmi'
import { Button, Sheet } from '@/components/ui/primitives'
import { shortAddress } from '@/lib/format'
import { privyEnabled } from '@/lib/privy'
import { useAuth } from '@/providers/AuthProvider'

export interface ConnectState {
  isConnected: boolean
  /** Opens the sign-in dialog, or the account menu once connected. */
  show: () => void
  address?: string
}

type Props = { children: (state: ConnectState) => ReactNode }

function KitConnect({ children }: Props) {
  return <ConnectKitButton.Custom>{({ isConnected, show, address }) => children({ isConnected, show: show ?? (() => {}), address })}</ConnectKitButton.Custom>
}

function AccountSheet({ open, onClose, address }: { open: boolean; onClose: () => void; address?: string }) {
  const { signOut } = useAuth()
  const copy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(address)
    toast.success('Address copied')
  }
  return (
    <Sheet open={open} onClose={onClose} title="Your account">
      <div className="space-y-4">
        <div>
          <p className="text-xs text-[var(--subtle)]">Wallet address</p>
          <p className="mono mt-1 break-all text-sm">{address}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" full onClick={() => void copy()}>
            <Copy className="size-4" aria-hidden /> Copy address
          </Button>
          <Button
            variant="secondary"
            full
            onClick={() => {
              onClose()
              void signOut()
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>
        <p className="text-xs text-[var(--subtle)]">Signed in as {address ? shortAddress(address) : 'your wallet'}.</p>
      </div>
    </Sheet>
  )
}

function PrivyConnect({ children }: Props) {
  const { ready, authenticated, login } = usePrivy()
  const { address, isConnected } = useAccount()
  const [menu, setMenu] = useState(false)
  const connected = authenticated && isConnected
  const show = () => {
    if (!ready) return
    if (!authenticated) login()
    else if (connected) setMenu(true)
  }
  return (
    <>
      {children({ isConnected: connected, show, address })}
      <AccountSheet open={menu} onClose={() => setMenu(false)} address={address} />
    </>
  )
}

const Implementation = privyEnabled ? PrivyConnect : KitConnect

/**
 * Sign-in control. Uses Privy login when configured, otherwise the browser-wallet dialog. Pressing it while signed out
 * also remembers that the person wants to sign in, so the signature prompt follows as soon as a wallet is connected.
 */
export function WalletConnect({ children }: Props) {
  const { requestSignIn } = useAuth()
  return (
    <Implementation>
      {(state) =>
        children({
          ...state,
          show: () => {
            if (!state.isConnected) requestSignIn()
            state.show()
          },
        })
      }
    </Implementation>
  )
}
