import { TokenUSDC } from '@web3icons/react'
import { Menu, Search, UserCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { WalletConnect } from '@/components/wallet/WalletConnect'
import { Button } from '@/components/ui/primitives'
import { formatMicro } from '@/lib/format'
import { useActivePlayback } from '@/lib/playback-store'
import { Link, navigate } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'
import { useSpendingWallet } from '@/providers/SpendingWalletProvider'
import { Wordmark } from './Brand'
import { useSidebar } from './Sidebar'

/** The live rate while a video plays, otherwise the spending balance. Both are real values. */
function RatePill() {
  const { user } = useAuth()
  const { balance } = useSpendingWallet()
  const playing = useActivePlayback()
  if (!user) return null
  const text = playing ? `$${formatMicro(playing.priceMicro)} / sec` : balance ? `$${formatMicro(balance.available)}` : '...'
  return (
    <Link
      to="/wallet"
      title={playing ? 'Price per second of the video you are watching' : 'Spending balance'}
      className="hidden min-h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[#181818] px-3 text-sm font-semibold tabular-nums transition-colors hover:bg-[#272727] md:flex"
    >
      <TokenUSDC variant="branded" size={22} aria-hidden />
      {text}
    </Link>
  )
}

function AccountArea() {
  const { user, signIn, signingIn } = useAuth()
  return (
    <WalletConnect>
      {({ isConnected, show }) => {
        if (!isConnected) {
          return (
            <button
              onClick={show}
              className="flex min-h-10 items-center gap-2 rounded-full border border-[var(--border)] px-4 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10"
            >
              <UserCircle className="size-5" aria-hidden /> Sign in
            </button>
          )
        }
        if (!user) {
          return (
            <Button onClick={() => void signIn()} loading={signingIn} className="min-h-10 rounded-full">
              Sign in
            </Button>
          )
        }
        return (
          <button onClick={show} aria-label="Account" className="rounded-full transition-opacity hover:opacity-85">
            <Avatar name={user.displayName ?? user.username} size={36} accent />
          </button>
        )
      }}
    </WalletConnect>
  )
}

export function Header() {
  const { toggle } = useSidebar()
  const [draft, setDraft] = useState('')
  const input = useRef<HTMLInputElement | null>(null)

  // "/" jumps to search, like most video sites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || target?.closest('input, textarea, [contenteditable]')) return
      event.preventDefault()
      input.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 bg-[var(--bg)] px-3 sm:gap-4 sm:px-4">
      <div className="flex items-center gap-1 sm:gap-3">
        <button onClick={toggle} aria-label="Toggle menu" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10">
          <Menu className="size-6" />
        </button>
        <Link to="/" aria-label="TickStream home">
          <Wordmark />
        </Link>
      </div>

      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const q = draft.trim()
          navigate(q ? `/explore?q=${encodeURIComponent(q)}` : '/explore')
        }}
        className="mx-auto hidden h-10 w-full max-w-[600px] flex-1 items-center sm:flex"
      >
        <input
          ref={input}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search videos..."
          aria-label="Search videos"
          className="h-full min-w-0 flex-1 rounded-l-full border border-[#303030] bg-[#121212] px-5 text-sm outline-none placeholder:text-[var(--subtle)] focus:border-[var(--accent)]"
        />
        <button type="submit" aria-label="Search" className="flex h-full w-16 items-center justify-center rounded-r-full border border-l-0 border-[#303030] bg-[#222] hover:bg-[#2f2f2f]">
          <Search className="size-5" />
        </button>
      </form>

      <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:gap-3">
        <Link to="/explore" aria-label="Search" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10 sm:hidden">
          <Search className="size-5" />
        </Link>
        <RatePill />
        <AccountArea />
      </div>
    </header>
  )
}
