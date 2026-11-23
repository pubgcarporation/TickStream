import { useEffect } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/ui/primitives'
import { Link, navigate, useLocation } from '@/lib/router'
import { AdminPage } from '@/pages/AdminPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { ExplorePage } from '@/pages/ExplorePage'
import { HomePage } from '@/pages/HomePage'
import { LibraryPage } from '@/pages/LibraryPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { StudioPage } from '@/pages/StudioPage'
import { WalletPage } from '@/pages/WalletPage'
import { WatchPage } from '@/pages/WatchPage'
import { AuthProvider } from '@/providers/AuthProvider'
import { SpendingWalletProvider } from '@/providers/SpendingWalletProvider'

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return null
}

function Routes() {
  const { path, search } = useLocation()
  const segments = path.split('/').filter(Boolean)
  const [first, second] = segments

  if (!first) return <HomePage />
  if (first === 'explore') return <ExplorePage />
  if (first === 'trending') return <Redirect to="/explore?sort=trending" />
  if (first === 'search') return <Redirect to={`/explore?q=${encodeURIComponent(search.get('q') ?? '')}`} />
  if (first === 'categories') {
    return second ? <Redirect to={`/explore?category=${encodeURIComponent(second)}`} /> : <CategoriesPage />
  }
  if (first === 'admin') return <AdminPage section={second ?? ''} />
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
