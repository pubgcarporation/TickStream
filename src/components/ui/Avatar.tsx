import { clsx } from 'clsx'
import { useState } from 'react'
import { avatarUrl } from '@/lib/api'

/** A stable colour per name, so the same creator always looks the same. */
function hueFor(name: string): number {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 360
  return hash
}

interface AvatarProps {
  name: string
  size?: number
  className?: string
  accent?: boolean
  /** With a version, the creator's profile picture is shown. Without one, or if it fails to load, the initial is. */
  username?: string
  version?: number | null
}

export function Avatar({ name, size = 36, className, accent, username, version }: AvatarProps) {
  const initial = (name.trim()[0] ?? '?').toUpperCase()
  const src = username && version ? avatarUrl(username, version) : null
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <span
      aria-hidden
      className={clsx('display relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold', className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: accent ? 'var(--accent)' : `hsl(${hueFor(name)} 45% 32%)`,
        color: accent ? 'var(--accent-ink)' : '#fff',
      }}
    >
      {initial}
      {src && failed !== src && (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(src)} className="absolute inset-0 size-full object-cover" />
      )}
    </span>
  )
}
