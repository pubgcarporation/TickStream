import { Upload } from 'lucide-react'
import { PageHeader, Tabs } from '@/components/ui/primitives'
import { Link, useLocation } from '@/lib/router'

const TABS = [
  { to: '/studio', label: 'Overview' },
  { to: '/studio/videos', label: 'Videos' },
  { to: '/studio/upload', label: 'Upload' },
  { to: '/studio/analytics', label: 'Analytics' },
  { to: '/studio/earnings', label: 'Earnings' },
  { to: '/studio/settings', label: 'Settings' },
]

export function StudioNav() {
  const { path } = useLocation()
  return (
    <div className="space-y-4">
      <PageHeader
        title="Studio"
        actions={
          path !== '/studio/upload' && (
            <Link
              to="/studio/upload"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
            >
              <Upload className="size-4" aria-hidden /> Upload a video
            </Link>
          )
        }
      />
      <Tabs id="studio" label="Studio sections" items={TABS.map((tab) => ({ ...tab, active: path === tab.to }))} />
    </div>
  )
}
