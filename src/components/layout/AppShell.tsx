import { clsx } from 'clsx'
import type { ReactNode } from 'react'
import { Link, useLocation } from '@/lib/router'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Sidebar, SidebarProvider, useSidebar } from './Sidebar'
import { Wordmark } from './Brand'

function Frame({ children }: { children: ReactNode }) {
  const { path } = useLocation()
  const { expanded } = useSidebar()
  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      <Sidebar />
      <div className={clsx('flex min-h-dvh flex-col pt-14 transition-[padding] duration-200', expanded ? 'lg:pl-60' : 'lg:pl-[76px]')}>
        {/* Keyed by path so each page enters with the same short rise. */}
        <main id="main" key={path} className="rise w-full flex-1 px-4 pb-28 pt-4 sm:px-6 lg:pb-12">
          {children}
        </main>
        <footer className="border-t border-[var(--border)]">
          <div className="grid gap-6 px-4 py-8 pb-28 text-sm text-[var(--subtle)] sm:px-6 md:grid-cols-[1.2fr_1fr] lg:pb-8">
            <div className="space-y-3">
              <Link to="/" aria-label="TickStream home">
                <Wordmark />
              </Link>
              <p className="max-w-xs text-pretty">Watch anything. Pay only for the seconds you watch.</p>
            </div>
            <p className="max-w-xs text-pretty md:justify-self-end">Running on Arc Testnet with test USDC. Nothing here moves real money.</p>
          </div>
        </footer>
      </div>
      <MobileNav />
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <Frame>{children}</Frame>
    </SidebarProvider>
  )
}
