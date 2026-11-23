import { Clapperboard, Compass, Home, Library, Wallet, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { Link, useLocation } from '@/lib/router'

const ITEMS: Array<{ to: string; label: string; icon: LucideIcon; exact?: boolean }> = [
  { to: '/', label: 'Home', icon: Home, exact: true },
  { to: '/explore', label: 'Explore', icon: Compass },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/studio', label: 'Studio', icon: Clapperboard },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
]

/** Thumb-reach navigation for phones. Desktop uses the header. */
export function MobileNav() {
  const { path } = useLocation()
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[#0d1b2f]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {ITEMS.map((item) => {
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
        })}
      </ul>
    </nav>
  )
}
