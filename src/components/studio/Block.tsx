import type { ReactNode } from 'react'

/** A compact titled block: one small heading row, an optional link on the right, then the content. */
export function Block({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-[var(--border)] px-3.5">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {action && <div className="text-xs">{action}</div>}
      </div>
      {children}
    </section>
  )
}
