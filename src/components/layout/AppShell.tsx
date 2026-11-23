import type { ReactNode } from 'react'
import { Link } from '@/lib/router'
import { Header } from './Header'
import { Wordmark } from './Brand'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-[var(--subtle)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link to="/" aria-label="TickStream home">
            <Wordmark />
          </Link>
          <p className="max-w-md text-pretty">
            Running on Arc Testnet with test USDC. Nothing here moves real money.
          </p>
        </div>
      </footer>
    </div>
  )
}
