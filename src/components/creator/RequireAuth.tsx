import { ConnectKitButton } from 'connectkit'
import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'
import { Button, EmptyState, Skeleton } from '@/components/ui/primitives'
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
        <ConnectKitButton.Custom>
          {({ isConnected, show }) =>
            isConnected ? (
              <Button loading={signingIn} onClick={() => void signIn()}>
                Sign in with your wallet
              </Button>
            ) : (
              <Button onClick={show}>
                <Wallet className="size-4" aria-hidden /> Connect wallet
              </Button>
            )
          }
        </ConnectKitButton.Custom>
      }
    />
  )
}
