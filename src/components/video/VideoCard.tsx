import { useState } from 'react'
import { CATEGORIES } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { Avatar } from '@/components/ui/Avatar'
import { thumbnailUrl } from '@/lib/api'
import { compactNumber, formatDuration, formatMicro, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

export function PriceTag({ priceMicro }: { priceMicro: number }) {
  return (
    <span className="mono rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">${formatMicro(priceMicro)}/s</span>
  )
}

export function VideoCard({ video, index = 0 }: { video: VideoSummary; index?: number }) {
  const [failed, setFailed] = useState(false)
  const category = CATEGORIES.find((c) => c.slug === video.category)?.label ?? 'Other'
  const name = video.creator.displayName ?? video.creator.username
  const fullCost = video.durationSeconds ? video.priceMicro * video.durationSeconds : null
  return (
    <article className="group rise" style={{ ['--i' as string]: Math.min(index, 8) }}>
      <Link to={`/watch/${video.id}`} className="block" aria-label={`Watch ${video.title}`}>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#272727] transition-[border-radius] duration-200 group-hover:rounded-none">
          {failed ? (
            <div className="flex size-full items-center justify-center text-xs text-[var(--subtle)]">No preview</div>
          ) : (
            <img src={thumbnailUrl(video.id)} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
          )}
          {video.previewSeconds > 0 && (
            <span className="absolute left-2 top-2 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)]">
              {video.previewSeconds}s free
            </span>
          )}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <PriceTag priceMicro={video.priceMicro} />
            <span className="rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums">{formatDuration(video.durationSeconds)}</span>
          </div>
        </div>
      </Link>
      <div className="mt-3 flex gap-3">
        <Link to={`/profile/${video.creator.username}`} aria-label={`${name}'s profile`}>
          <Avatar name={name} size={36} />
        </Link>
        <div className="min-w-0">
          <Link to={`/watch/${video.id}`} className="line-clamp-2 text-pretty text-base font-semibold leading-snug">
            {video.title}
          </Link>
          <Link to={`/profile/${video.creator.username}`} className="mt-1 block truncate text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            {name}
          </Link>
          <p className="text-sm tabular-nums text-[var(--muted)]">
            {compactNumber(video.views)} views · {timeAgo(video.createdAt)} · {category}
          </p>
          {fullCost !== null && (
            <p className="text-xs tabular-nums text-[var(--subtle)]">About ${formatMicro(fullCost)} to watch it all</p>
          )}
        </div>
      </div>
    </article>
  )
}
