import { motion } from 'framer-motion'
import { Upload } from 'lucide-react'
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
    <div className="mb-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-bold">Studio</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Set a price per second and get paid as people watch.</p>
        </div>
        {path !== '/studio/upload' && (
          <Link
            to="/studio/upload"
            className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Upload className="size-4" aria-hidden /> Upload a video
          </Link>
        )}
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Studio sections">
        {TABS.map((tab) => {
          const active = path === tab.to
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                active ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
              )}
            >
              {tab.label}
              {active && (
                <motion.span
                  layoutId="studio-tab"
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--accent)]"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
