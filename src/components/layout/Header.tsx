import { ConnectKitButton } from 'connectkit'
import { Menu, Wallet, X } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { Link, useLocation } from '@/lib/router'
import { formatMicro, shortAddress } from '@/lib/format'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'
import { Button } from '@/components/ui/primitives'
import { Wordmark } from './Brand'

const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/library', label: 'Library' },
  { to: '/studio', label: 'Studio' },
  { to: '/wallet', label: 'Wallet' },
]

function AccountArea() {
  const { user, signIn, signingIn } = useAuth()
  const { balance } = useSpendingWallet()
  return (
    <ConnectKitButton.Custom>
      {({ isConnected, show, address }) => {
        if (!isConnected) {
          return (
            <Button onClick={show} className="min-h-10">
              <Wallet className="size-4" aria-hidden /> Connect wallet
            </Button>
          )
        }
        return (
          <div className="flex items-center gap-2">
            {user && balance && (
              <Link
                to="/wallet"
                className="glass-inner hidden min-h-10 items-center gap-2 rounded-2xl px-3.5 text-sm font-semibold tabular-nums sm:flex"
                title="Spending balance"
              >
                {formatMicro(balance.available)} <span className="text-xs font-medium text-[var(--subtle)]">USDC</span>
              </Link>
            )}
            {!user && (
              <Button onClick={() => void signIn()} loading={signingIn} className="min-h-10">
                Sign in
              </Button>
            )}
            <button
              onClick={show}
              className="glass-inner mono min-h-10 rounded-2xl px-3.5 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {address ? shortAddress(address) : 'Wallet'}
            </button>
          </div>
        )
      }}
    </ConnectKitButton.Custom>
  )
}

export function Header() {
  const { path } = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0d1b2f]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" aria-label="TickStream home">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                path.startsWith(item.to) ? 'bg-white/10 text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <AccountArea />
          <button
            className="flex size-11 items-center justify-center rounded-xl text-[var(--muted)] hover:bg-white/10 md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-[var(--border)] px-4 py-2 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-3 text-sm font-medium text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
