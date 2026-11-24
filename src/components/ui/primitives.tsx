import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { clsx } from 'clsx'

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

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx('rise border-b border-[var(--border)] pb-6 last:border-b-0 last:pb-0', className)}>{children}</section>
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

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
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
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
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
            className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--border)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-xl"
            style={{ background: '#212121' }}
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
    </AnimatePresence>
  )
}

export const inputClass =
  'w-full rounded-lg border border-[#303030] bg-[#121212] px-3.5 py-2.5 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--subtle)] focus:border-[var(--accent)]'
