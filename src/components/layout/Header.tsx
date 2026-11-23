import { motion } from 'framer-motion'
import { Search, Wallet } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Link, navigate, useLocation } from '@/lib/router'
import { formatMicro, shortAddress } from '@/lib/format'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'
import { Button } from '@/components/ui/primitives'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { Wordmark } from './Brand'

const NAV = [
  { to: '/explore', label: 'Explore' },
  { to: '/library', label: 'Library' },
  { to: '/studio', label: 'Studio' },
  { to: '/wallet', label: 'Wallet' },
]
const ADMIN_ITEM = { to: '/admin', label: 'Admin' }

function AccountArea() {
  const { user, signIn, signingIn } = useAuth()
  const { balance } = useSpendingWallet()
  return (
    <WalletConnect>
      {({ isConnected, show, address }) => {
        if (!isConnected) {
          return (
            <Button onClick={show} className="min-h-10">
              <Wallet className="size-4" aria-hidden /> Sign in
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
                <span className="size-1.5 rounded-full bg-[var(--success)]" aria-hidden />
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
              aria-label="Account"
            >
              {address ? shortAddress(address) : 'Account'}
            </button>
          </div>
        )
      }}
    </WalletConnect>
  )
}

/** Searches titles and creators. Press "/" anywhere to jump here. */
function SearchBox() {
  const input = useRef<HTMLInputElement | null>(null)
  const { search } = useLocation()
  const [value, setValue] = useState(search.get('q') ?? '')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <form
      role="search"
      className="relative hidden w-full max-w-xs md:block lg:max-w-sm"
      onSubmit={(event) => {
        event.preventDefault()
        const q = value.trim()
        navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
        input.current?.blur()
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--subtle)]" aria-hidden />
      <input
        ref={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search videos and creators"
        aria-label="Search videos and creators"
        className="glass-inner h-10 w-full rounded-2xl pl-10 pr-9 text-sm outline-none placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
      />
      <kbd className="mono pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-[var(--border)] px-1.5 text-[10px] text-[var(--subtle)] lg:block">/</kbd>
    </form>
  )
}

export function Header() {
  const { path } = useLocation()
  const { isAdmin } = useAuth()
  const items = isAdmin ? [...NAV, ADMIN_ITEM] : NAV
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[#0d1b2f]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:gap-6">
        <Link to="/" aria-label="TickStream home" className="shrink-0">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {items.map((item) => {
            const active = path.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors',
                  active ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className="absolute inset-0 -z-10 rounded-xl bg-white/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <SearchBox />
          <AccountArea />
        </div>
      </div>
    </header>
  )
}
