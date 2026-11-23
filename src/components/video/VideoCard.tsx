import { useState } from 'react'
import { Clock3 } from 'lucide-react'
import type { VideoSummary } from '@shared/types'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro } from '@/lib/format'
import { Link } from '@/lib/router'
import { CATEGORIES } from '@shared/constants'

export function PriceTag({ priceMicro }: { priceMicro: number }) {
  return (
    <span className="mono rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--ink)] backdrop-blur">
      ${formatMicro(priceMicro)}/s
    </span>
  )
}

export function VideoCard({ video }: { video: VideoSummary }) {
  const [failed, setFailed] = useState(false)
  const category = CATEGORIES.find((c) => c.slug === video.category)?.label ?? 'Other'
  return (
    <article className="group">
      <Link to={`/watch/${video.id}`} className="block" aria-label={`Watch ${video.title}`}>
        <div className="glass-inner relative aspect-video overflow-hidden rounded-2xl">
          {failed ? (
            <div className="flex size-full items-center justify-center text-xs text-[var(--subtle)]">No preview</div>
          ) : (
            <img
              src={thumbnailUrl(video.id)}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
            <PriceTag priceMicro={video.priceMicro} />
            <span className="mono flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] tabular-nums backdrop-blur">
              <Clock3 className="size-3" aria-hidden /> {formatDuration(video.durationSeconds)}
            </span>
          </div>
        </div>
        <h3 className="mt-3 line-clamp-2 text-pretty text-[15px] font-semibold leading-snug">{video.title}</h3>
      </Link>
      <p className="mt-1 text-xs text-[var(--subtle)]">
        <Link to={`/profile/${video.creator.username}`} className="hover:text-[var(--ink)]">
          {video.creator.displayName ?? video.creator.username}
        </Link>
        <span aria-hidden> · </span>
        {category}
        <span aria-hidden> · </span>
        <span className="tabular-nums">{video.views} views</span>
      </p>
    </article>
  )
}
