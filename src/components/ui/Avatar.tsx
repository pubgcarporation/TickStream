import { clsx } from 'clsx'

/** A stable colour per name, so the same creator always looks the same. */
function hueFor(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

export function Avatar({ name, size = 36, className, accent }: { name: string; size?: number; className?: string; accent?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  return (
    <span
      aria-hidden
      className={clsx('display inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: accent ? 'var(--accent)' : `hsl(${hueFor(name)} 45% 32%)`,
        color: accent ? 'var(--accent-ink)' : '#fff',
      }}
    >
      {initial}
    </span>
  )
}
