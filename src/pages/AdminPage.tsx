import { clsx } from 'clsx'
import { RequireAuth } from '@/components/creator/RequireAuth'
import { EmptyState } from '@/components/ui/primitives'
import { Link } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'
import { AdminOverview } from './admin/AdminOverview'
import { AdminPayments, AdminUsers } from './admin/AdminTables'
import { AdminVideos } from './admin/AdminVideos'

const TABS = [
  { section: '', label: 'Overview' },
  { section: 'videos', label: 'Videos' },
  { section: 'payments', label: 'Payments' },
  { section: 'users', label: 'Users' },
]

function Console({ section }: { section: string }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return (
      <EmptyState
        title="Administrators only"
        body="Your wallet is not on the administrator list. Add its address to ADMIN_ADDRESSES on the server and restart the API."
      />
    )
  }
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Admin sections">
        {TABS.map((tab) => (
          <Link
            key={tab.section}
            to={tab.section ? `/admin/${tab.section}` : '/admin'}
            className={clsx(
              '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors',
              section === tab.section ? 'border-[var(--accent)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {section === '' && <AdminOverview />}
      {section === 'videos' && <AdminVideos />}
      {section === 'payments' && <AdminPayments />}
      {section === 'users' && <AdminUsers />}
    </div>
  )
}

export function AdminPage({ section }: { section: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <RequireAuth title="Sign in to continue" body="Sign in with an administrator account.">
        <Console section={section} />
      </RequireAuth>
    </div>
  )
}
