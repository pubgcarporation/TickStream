import { useState } from 'react'
import { compactNumber, timeAgo } from '@/lib/format'

/** Views, age, category and description in one surface. Long descriptions fold until expanded. */
export function VideoDescription({ views, createdAt, category, description }: { views: number; createdAt: string; category: string; description: string }) {
  const [open, setOpen] = useState(false)
  const long = description.length > 180 || description.split('\n').length > 3

  return (
    <div className="rounded-xl bg-[var(--surface)] p-4 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold tabular-nums">
        <span>{compactNumber(views)} views</span>
        <span className="text-[var(--subtle)]" aria-hidden>
          ·
        </span>
        <span>{timeAgo(createdAt)}</span>
        <span className="ml-1 rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-[var(--ink-2)]">{category}</span>
      </p>
      {description ? (
        <>
          <p className={`mt-2 max-w-3xl whitespace-pre-wrap text-pretty text-[var(--ink-2)] ${open ? '' : 'line-clamp-3'}`}>{description}</p>
          {long && (
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mt-2 text-xs font-semibold text-[var(--ink)] hover:underline">
              {open ? 'Show less' : 'Show more'}
            </button>
          )}
        </>
      ) : (
        <p className="mt-2 text-[var(--subtle)]">No description.</p>
      )}
    </div>
  )
}
