import { RequireAuth } from '@/components/creator/RequireAuth'
import { EmptyState, PageHeader, Tabs } from '@/components/ui/primitives'
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
    <div className="space-y-4">
      <Tabs id="admin" label="Admin sections" items={TABS.map((tab) => ({ to: tab.section ? `/admin/${tab.section}` : '/admin', label: tab.label, active: section === tab.section }))} />
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
      <PageHeader title="Admin" />
      <RequireAuth title="Sign in to continue" body="Sign in with an administrator account.">
        <Console section={section} />
      </RequireAuth>
    </div>
  )
}
