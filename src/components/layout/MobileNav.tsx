import { Clapperboard, Compass, Home, Plus, Upload, Video, Wallet, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { Sheet } from '@/components/ui/primitives'
import { Link, navigate, useLocation } from '@/lib/router'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  exact?: boolean
}

const LEFT: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/explore', label: 'Explore', icon: Compass },
]
const RIGHT: NavItem[] = [
  { to: '/studio', label: 'Studio', icon: Clapperboard },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
]

const CREATE: Array<{ to: string; title: string; body: string; icon: LucideIcon }> = [
  { to: '/studio/upload', title: 'Upload a video', body: 'Set a price per second and publish.', icon: Upload },
  { to: '/studio/videos', title: 'Your videos', body: 'Edit, price or remove what you published.', icon: Video },
]

/** Thumb-reach navigation for phones. Desktop uses the header. History and Following are in the menu. */
export function MobileNav() {
  const { path } = useLocation()
  const [creating, setCreating] = useState(false)

  const link = (item: NavItem) => {
    const active = item.exact ? path === item.to : path.startsWith(item.to)
    return (
      <li key={item.to} className="flex-1">
        <Link
          to={item.to}
          aria-current={active ? 'page' : undefined}
          className={clsx(
            'flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] font-medium transition-colors',
            active ? 'text-[var(--accent)]' : 'text-[var(--subtle)] hover:text-[var(--ink)]',
          )}
        >
          <item.icon className="size-5" aria-hidden />
          {item.label}
        </Link>
      </li>
    )
  }

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[#0f0f0f]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {LEFT.map(link)}
          <li className="flex flex-1 items-center justify-center">
            <button
              type="button"
              onClick={() => setCreating(true)}
              aria-label="Create"
              aria-haspopup="dialog"
              className="flex size-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] shadow-lg shadow-black/40 transition-transform active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2.5} aria-hidden />
            </button>
          </li>
          {RIGHT.map(link)}
        </ul>
      </nav>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Create">
        <ul className="-mx-2 space-y-1">
          {CREATE.map((item) => (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  navigate(item.to)
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--surface-muted)]">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-[var(--muted)]">{item.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
