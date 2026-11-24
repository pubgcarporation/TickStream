import { Upload } from 'lucide-react'
import { Tabs } from '@/components/ui/primitives'
import { TimeframePicker } from '@/components/studio/TimeframePicker'
import { Link, useLocation } from '@/lib/router'

const TABS = [
  { to: '/studio', label: 'Overview' },
  { to: '/studio/videos', label: 'Videos' },
  { to: '/studio/upload', label: 'Upload' },
  { to: '/studio/analytics', label: 'Analytics' },
  { to: '/studio/earnings', label: 'Earnings' },
  { to: '/studio/settings', label: 'Settings' },
]

/** Screens whose numbers depend on the timeframe. */
const TIMED = new Set(['/studio', '/studio/videos', '/studio/analytics', '/studio/earnings'])

/**
 * One slim bar: the title, the sections, and the controls that matter on this screen (the timeframe filter and the
 * upload shortcut). On a narrow screen the sections move to their own scrollable line under the title.
 */
export function StudioNav() {
  const { path } = useLocation()
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-x-3 border-b border-[var(--border)]">
      <h1 className="display order-1 min-h-9 content-center text-lg font-bold leading-9">Studio</h1>
      <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
        {TIMED.has(clean) && <TimeframePicker />}
        {clean !== '/studio/upload' && (
          <Link
            to="/studio/upload"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            <Upload className="size-3.5" aria-hidden /> <span className="max-sm:sr-only">Upload</span>
          </Link>
        )}
      </div>
      <Tabs
        id="studio"
        label="Studio sections"
        dense
        className="order-3 -mx-4 w-[calc(100%+2rem)] px-2 sm:mx-0 sm:w-full sm:px-0 lg:order-2 lg:w-auto lg:min-w-0 lg:flex-1"
        items={TABS.map((tab) => ({ ...tab, active: clean === tab.to }))}
      />
    </div>
  )
}
