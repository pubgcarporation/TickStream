import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { CloudOff, Loader2, X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { Link } from '@/lib/router'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  full?: boolean
  /** Pill is the default. Rect gives the squarer, denser look used on watch and studio screens. */
  shape?: 'pill' | 'rect'
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]',
  secondary: 'border border-[var(--border)] text-[var(--ink)] hover:bg-white/10',
  ghost: 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white/5',
  danger: 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25',
}

export function Button({ variant = 'primary', shape = 'pill', loading, full, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex min-h-10 items-center justify-center gap-2 px-4 text-sm font-semibold transition-all',
        shape === 'pill' ? 'rounded-full' : 'rounded-lg',
        'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40',
        VARIANTS[variant],
        full && 'w-full',
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/**
 * The title row every page except Home starts with. It sits right under the header with the same small gap Home's
 * topic strip has, and leaves the same gap below it, so moving between pages never shifts the content.
 * Put it first inside a `space-y-4` wrapper.
 */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="-mb-2 -mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-2 pt-1">
      <div className="min-w-0">
        <h1 className="display text-xl font-bold leading-8 sm:text-2xl">{title}</h1>
        {subtitle && <p className="-mt-0.5 text-pretty text-sm text-[var(--muted)]">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}

export interface TabItem {
  to: string
  label: string
  active: boolean
}

/** Underlined page sections. The line slides to the active tab. `id` keeps two tab rows from sharing one line. */
export function Tabs({ id, label, items, className, dense }: { id: string; label: string; items: TabItem[]; className?: string; dense?: boolean }) {
  return (
    <nav className={clsx('flex gap-1 overflow-x-auto [scrollbar-width:none]', dense ? 'self-stretch' : '-mx-4 border-b border-[var(--border)] px-2 sm:mx-0 sm:px-0', className)} aria-label={label}>
      <LayoutGroup id={id}>
        {items.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={tab.active ? 'page' : undefined}
            className={clsx(
              'relative whitespace-nowrap font-medium transition-colors',
              dense ? 'flex min-h-9 items-center px-3 text-[13px]' : 'min-h-11 px-3.5 py-2.5 text-sm',
              tab.active ? 'text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {tab.label}
            {tab.active && (
              <motion.span layoutId="tab-line" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
          </Link>
        ))}
      </LayoutGroup>
    </nav>
  )
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('rise rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5', className)}>{children}</section>
}

/** A bordered surface for grouped content such as the payment panel and analytics blocks. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('rise rounded-xl border border-[var(--border)] bg-[var(--surface)]', className)}>{children}</section>
}

/** One choice out of a few, shown as connected segments. Reads better than a row of loose chips. */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string; disabled?: boolean }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-lg bg-[var(--surface-muted)] p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={clsx(
              'min-h-9 rounded-md px-2 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35',
              active ? 'bg-[#3d3d3d] text-[var(--ink)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Chip({
  active,
  onClick,
  children,
  disabled,
  size = 'md',
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        'whitespace-nowrap rounded-full border font-medium transition-colors disabled:opacity-40',
        size === 'sm' ? 'min-h-8 px-3 text-[13px]' : 'min-h-9 px-4 text-sm',
        active
          ? 'border-[#f1f1f1] bg-[#f1f1f1] text-[#0f0f0f]'
          : 'border-[var(--border)] bg-[#181818] text-[var(--ink)] hover:bg-[#2a2a2a]',
      )}
    >
      {children}
    </button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-2xl', className)} aria-hidden />
}

export function EmptyState({ title, body, action, icon: Icon }: { title: string; body?: string; action?: ReactNode; icon?: LucideIcon }) {
  return (
    <div className="rise flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      {Icon && (
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-white/[0.06] text-[var(--muted)]">
          <Icon className="size-6" aria-hidden />
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {body && <p className="max-w-sm text-pretty text-sm text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

/** Shown when a request fails, so a page never sits on loading placeholders forever. */
export function ErrorState({ title = 'Could not load this', message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={CloudOff}
        title={title}
        body={message ?? 'Check your connection and try again.'}
        action={
          onRetry && (
            <Button variant="secondary" onClick={onRetry}>
              Try again
            </Button>
          )
        }
      />
    </div>
  )
}

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  const panel = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    // Keyboard and screen reader users land inside the sheet, and go back to what opened it when it closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusTimer = setTimeout(() => {
      const target = panel.current?.querySelector<HTMLElement>('input, textarea, select, button:not([aria-label="Close"])') ?? panel.current
      target?.focus({ preventScroll: true })
    }, 60)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panel.current) return
      // Keep Tab inside the sheet while it is open.
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')).filter((el) => el.offsetParent !== null)
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    // The page behind stays still while the sheet is open, so the sheet is always what you see.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
      opener?.focus({ preventScroll: true })
    }
  }, [open, onClose])
  // Rendered straight into <body>. A sheet nested inside an animated or blurred parent would otherwise be placed
  // relative to that parent, so it could open below the visible screen.
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <motion.section
            ref={panel}
            tabIndex={-1}
            className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--border)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-xl"
            style={{ background: '#212121', outline: 'none' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex size-11 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export const inputClass =
  'w-full rounded-lg border border-[#303030] bg-[#121212] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--subtle)] focus:border-[var(--accent)]'
