import { clsx } from 'clsx'
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
    <div className="mb-8 space-y-4">
      <h1 className="display text-4xl font-bold">Studio</h1>
      <nav className="flex gap-1 overflow-x-auto" aria-label="Studio sections">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={path === tab.to ? 'page' : undefined}
            className={clsx(
              'whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors',
              path === tab.to ? 'bg-white/10 text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
