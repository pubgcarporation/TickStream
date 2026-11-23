import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/ui/primitives'
import { Link, useLocation } from '@/lib/router'
import { ExplorePage } from '@/pages/ExplorePage'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { StudioPage } from '@/pages/StudioPage'
import { WalletPage } from '@/pages/WalletPage'
import { WatchPage } from '@/pages/WatchPage'
import { AuthProvider } from '@/providers/AuthProvider'
import { SpendingWalletProvider } from '@/providers/SpendingWalletProvider'

function Routes() {
  const { path } = useLocation()
  const segments = path.split('/').filter(Boolean)
  const [first, second] = segments

  if (!first) return <HomePage />
  if (first === 'explore') return <ExplorePage />
  if (first === 'watch' && second) return <WatchPage key={second} videoId={second} />
  if (first === 'studio') return <StudioPage section={second ?? ''} />
  if (first === 'library') return <LibraryPage />
  if (first === 'wallet') return <WalletPage />
  if (first === 'profile' && second) return <ProfilePage key={second} username={second} />
  return (
    <EmptyState
      title="Page not found"
      body="That page does not exist."
      action={
        <Link to="/" className="text-sm font-semibold text-[var(--accent)]">
          Back to home
        </Link>
      }
    />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SpendingWalletProvider>
        <AppShell>
          <Routes />
        </AppShell>
      </SpendingWalletProvider>
    </AuthProvider>
  )
}
