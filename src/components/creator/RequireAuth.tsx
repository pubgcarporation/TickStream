import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { useAuth } from '@/providers/AuthProvider'

/** Gate for pages that need a connected wallet and a signed-in session. */
export function RequireAuth({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  const { user, ready, signIn, signingIn } = useAuth()
  if (!ready) return <Skeleton className="h-64" />
  if (user) return <>{children}</>
  return (
    <EmptyState
      title={title}
      body={body}
      action={
        <WalletConnect>
          {({ isConnected, show, loading }) =>
            loading ? (
              <span className="skeleton block h-10 w-28 rounded-full" aria-hidden />
            ) : isConnected ? (
              <Button loading={signingIn} onClick={() => void signIn()}>
                Sign in
              </Button>
            ) : (
              <Button onClick={show}>
                <Wallet className="size-4" aria-hidden /> Sign in
              </Button>
            )
          }
        </WalletConnect>
      }
    />
  )
}
