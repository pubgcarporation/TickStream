import { useState } from 'react'
import { timeAgoLong, viewsLabel } from '@/lib/format'

const CARD = 'block w-full rounded-xl bg-white/[0.06] px-3 py-2 text-left text-[13px] leading-[18px]'

/**
 * The grey description card under a video: views, age and category on top, the text folded to two lines. Tapping
 * the card opens or folds it, as on a video site.
 */
export function VideoDescription({ views, createdAt, category, description }: { views: number; createdAt: string; category: string; description: string }) {
  const [open, setOpen] = useState(false)
  const long = description.length > 110 || description.split('\n').length > 2
  const stats = (
    <span className="block font-semibold tabular-nums">
      {viewsLabel(views)} <span className="ml-1">{timeAgoLong(createdAt)}</span> <span className="ml-1 font-medium text-[var(--muted)]">#{category.toLowerCase()}</span>
    </span>
  )
  if (!description) return <div className={CARD}>{stats}</div>
  return (
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={`${CARD} transition-colors hover:bg-white/10`}>
      {stats}
      <span className={`mt-1 block whitespace-pre-wrap text-pretty text-[var(--ink-2)] ${open ? '' : 'line-clamp-2'}`}>{description}</span>
      {long && <span className="mt-0.5 block font-semibold text-[var(--ink)]">{open ? 'Show less' : '...more'}</span>}
    </button>
  )
}
