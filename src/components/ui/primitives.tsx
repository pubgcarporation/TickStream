import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
  full?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[var(--accent)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]',
  secondary: 'glass-inner text-[var(--ink)] hover:bg-white/10',
  ghost: 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-white/5',
  danger: 'bg-[var(--danger)]/15 text-[var(--danger)] hover:bg-[var(--danger)]/25',
}

export function Button({ variant = 'primary', loading, full, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition-all',
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

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('glass rounded-3xl p-5', className)}>{children}</section>
}

export function Chip({
  active,
  onClick,
  children,
  disabled,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={clsx(
        'min-h-9 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-40',
        active
          ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'glass-inner text-[var(--muted)] hover:text-[var(--ink)]',
      )}
    >
      {children}
    </button>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-2xl bg-white/[0.07]', className)} aria-hidden />
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="glass-inner flex flex-col items-center gap-2 rounded-3xl px-6 py-12 text-center">
      <h3 className="display text-xl font-semibold">{title}</h3>
      {body && <p className="max-w-sm text-pretty text-sm text-[var(--muted)]">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
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
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          onKeyDown={(event) => event.key === 'Escape' && onClose()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <motion.section
            className="glass relative w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl"
            style={{ background: 'rgba(18, 45, 69, 0.92)' }}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-xl font-semibold">{title}</h2>
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
    </AnimatePresence>
  )
}

export const inputClass =
  'glass-inner w-full rounded-2xl px-4 py-3 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--subtle)] focus:border-[var(--accent)]'
