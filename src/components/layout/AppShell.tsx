import type { ReactNode } from 'react'
import { Link, useLocation } from '@/lib/router'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Wordmark } from './Brand'

export function AppShell({ children }: { children: ReactNode }) {
  const { path } = useLocation()
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header />
      {/* Keyed by path so each page enters with the same short rise. */}
      <main id="main" key={path} className="rise mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-8 sm:px-6 lg:pb-12">
        {children}
      </main>
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 pb-28 text-sm text-[var(--subtle)] sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:pb-10">
          <div className="space-y-3">
            <Link to="/" aria-label="TickStream home">
              <Wordmark />
            </Link>
            <p className="max-w-xs text-pretty">Watch anything. Pay only for the seconds you watch.</p>
          </div>
          <nav aria-label="Footer" className="grid content-start gap-2">
            <Link to="/explore" className="hover:text-[var(--ink)]">
              Explore
            </Link>
            <Link to="/categories" className="hover:text-[var(--ink)]">
              Categories
            </Link>
            <Link to="/studio/upload" className="hover:text-[var(--ink)]">
              Upload a video
            </Link>
          </nav>
          <p className="max-w-xs text-pretty">Running on Arc Testnet with test USDC. Nothing here moves real money.</p>
        </div>
      </footer>
      <MobileNav />
    </div>
  )
}
