import { ArrowRight, Clapperboard, Compass, Flame, History, Home, LayoutGrid, Library, Shield, Upload, Users, Wallet, X, Zap, type LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'
import { HowItWorksSheet } from './HowItWorksSheet'
import { safeStorage } from '@/lib/safe-storage'
import { Wordmark } from './Brand'

const KEY = 'tickstream:sidebar'

interface SidebarState {
  /** Wide sidebar on large screens, or the icon-only rail. */
  expanded: boolean
  drawerOpen: boolean
  toggle: () => void
  closeDrawer: () => void
}

const SidebarContext = createContext<SidebarState | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(() => safeStorage.get(KEY) !== 'rail')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const toggle = useCallback(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setExpanded((value) => {
        safeStorage.set(KEY, value ? 'rail' : 'wide')
        return !value
      })
    } else {
      setDrawerOpen((value) => !value)
    }
  }, [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])
  const value = useMemo(() => ({ expanded, drawerOpen, toggle, closeDrawer }), [expanded, drawerOpen, toggle, closeDrawer])
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}

export function useSidebar(): SidebarState {
  const context = useContext(SidebarContext)
  if (!context) throw new Error('useSidebar must be used inside SidebarProvider')
  return context
}

interface Item {
  to: string
  label: string
  icon: LucideIcon
  /** How to decide the item is the current page. */
  match: (path: string, search: URLSearchParams) => boolean
}

const MAIN: Item[] = [
  { to: '/', label: 'Home', icon: Home, match: (path) => path === '/' },
  { to: '/explore', label: 'Explore', icon: Compass, match: (path, search) => path.startsWith('/explore') && search.get('sort') !== 'trending' },
  { to: '/explore?sort=trending', label: 'Trending', icon: Flame, match: (path, search) => path.startsWith('/explore') && search.get('sort') === 'trending' },
  { to: '/categories', label: 'Categories', icon: LayoutGrid, match: (path) => path.startsWith('/categories') },
]

const YOU: Item[] = [
  { to: '/library', label: 'Library', icon: Library, match: (path, search) => path.startsWith('/library') && !search.get('tab') },
  { to: '/library?tab=history', label: 'History', icon: History, match: (path, search) => path.startsWith('/library') && search.get('tab') === 'history' },
  { to: '/library?tab=following', label: 'Following', icon: Users, match: (path, search) => path.startsWith('/library') && search.get('tab') === 'following' },
]

const CREATE: Item[] = [
  { to: '/studio', label: 'Studio', icon: Clapperboard, match: (path) => path.startsWith('/studio') && path !== '/studio/upload' },
  { to: '/studio/upload', label: 'Upload', icon: Upload, match: (path) => path === '/studio/upload' },
  { to: '/wallet', label: 'Wallet', icon: Wallet, match: (path) => path.startsWith('/wallet') },
]

const ADMIN: Item = { to: '/admin', label: 'Admin', icon: Shield, match: (path) => path.startsWith('/admin') }

function Row({ item, wide, onNavigate }: { item: Item; wide: boolean; onNavigate?: () => void }) {
  const { path, search } = useLocation()
  const active = item.match(path, search)
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'relative flex items-center rounded-xl transition-colors',
        wide ? 'min-h-11 gap-4 px-3 text-sm' : 'min-h-16 flex-col justify-center gap-1 px-1 text-[10px]',
        active ? 'bg-[#12311b] font-semibold text-white' : 'text-[var(--ink)] hover:bg-white/10',
      )}
    >
      {active && wide && <span className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-[var(--accent)]" aria-hidden />}
      <item.icon className={clsx('size-5 shrink-0', active && 'text-[var(--accent)]')} aria-hidden />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function Group({ items, wide, onNavigate }: { items: Item[]; wide: boolean; onNavigate?: () => void }) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.to}>
          <Row item={item} wide={wide} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  )
}

function Rule() {
  return <hr className="my-3 border-[var(--border)]" />
}

function Content({ wide, onNavigate, onLearn }: { wide: boolean; onNavigate?: () => void; onLearn: () => void }) {
  const { isAdmin } = useAuth()
  const create = isAdmin ? [...CREATE, ADMIN] : CREATE
  return (
    <div className="flex min-h-full flex-col">
      <Group items={MAIN} wide={wide} onNavigate={onNavigate} />
      <Rule />
      <Group items={YOU} wide={wide} onNavigate={onNavigate} />
      <Rule />
      <Group items={create} wide={wide} onNavigate={onNavigate} />
      {wide && (
        <div className="mt-auto pt-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[#181818] p-4">
            <Zap className="size-6 fill-[var(--accent)] text-[var(--accent)]" aria-hidden />
            <p className="mt-2 text-sm font-semibold leading-snug">Pay per second</p>
            <p className="text-xs text-[var(--subtle)]">with USDC</p>
            <button
              onClick={() => {
                onNavigate?.()
                onLearn()
              }}
              className="mt-4 flex min-h-9 items-center gap-2 text-xs font-semibold hover:text-[var(--accent)]"
            >
              Learn More <ArrowRight className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const { expanded, drawerOpen, closeDrawer } = useSidebar()
  const [learn, setLearn] = useState(false)

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen, closeDrawer])

  return (
    <>
      <aside
        aria-label="Sections"
        className={clsx(
          'fixed bottom-0 left-0 top-14 z-30 hidden overflow-y-auto bg-[var(--bg)] px-3 pb-4 pt-2 lg:block',
          expanded ? 'w-60' : 'w-[76px]',
        )}
      >
        <Content wide={expanded} onLearn={() => setLearn(true)} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Sections">
          <button className="absolute inset-0 bg-black/60" onClick={closeDrawer} aria-label="Close menu" />
          <div className="rise absolute inset-y-0 left-0 w-64 overflow-y-auto bg-[var(--bg)] p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <Link to="/" onClick={closeDrawer} aria-label="TickStream home">
                <Wordmark />
              </Link>
              <button onClick={closeDrawer} aria-label="Close menu" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10">
                <X className="size-5" />
              </button>
            </div>
            <Content wide onNavigate={closeDrawer} onLearn={() => setLearn(true)} />
          </div>
        </div>
      )}
      <HowItWorksSheet open={learn} onClose={() => setLearn(false)} />
    </>
  )
}
