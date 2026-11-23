import { useState, type CSSProperties } from 'react'
import { Clock3, Play } from 'lucide-react'
import { CATEGORIES } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro } from '@/lib/format'
import { Link } from '@/lib/router'

export function PriceTag({ priceMicro }: { priceMicro: number }) {
  return (
    <span className="mono rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--ink)] backdrop-blur">
      ${formatMicro(priceMicro)}/s
    </span>
  )
}

export function VideoCard({ video, index = 0 }: { video: VideoSummary; index?: number }) {
  const [failed, setFailed] = useState(false)
  const category = CATEGORIES.find((c) => c.slug === video.category)?.label ?? 'Other'
  const wholeVideo = video.durationSeconds ? video.priceMicro * video.durationSeconds : null
  return (
    <article className="group rise" style={{ '--i': Math.min(index, 12) } as CSSProperties}>
      <Link to={`/watch/${video.id}`} className="block rounded-2xl outline-offset-4" aria-label={`Watch ${video.title}`}>
        <div className="glass-inner relative aspect-video overflow-hidden rounded-2xl transition-transform duration-300 group-hover:-translate-y-0.5">
          {failed ? (
            <div className="flex size-full items-center justify-center text-xs text-[var(--subtle)]">No preview</div>
          ) : (
            <img
              src={thumbnailUrl(video.id)}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80" aria-hidden />
          <span
            className="absolute left-1/2 top-1/2 flex size-12 -translate-x-1/2 -translate-y-1/2 scale-90 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)] opacity-0 shadow-lg transition-all duration-300 group-hover:scale-100 group-hover:opacity-100"
            aria-hidden
          >
            <Play className="size-5 translate-x-0.5 fill-current" />
          </span>
          {video.previewSeconds > 0 && (
            <span className="absolute left-2 top-2 rounded-full bg-[var(--success)]/90 px-2.5 py-1 text-[11px] font-semibold text-[#0d1b2f]">
              {video.previewSeconds}s free
            </span>
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
            <PriceTag priceMicro={video.priceMicro} />
            <span className="mono flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] tabular-nums backdrop-blur">
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
      {wholeVideo !== null && (
        <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
          About <span className="font-semibold text-[var(--ink)]">${formatMicro(wholeVideo)}</span> to watch it all
        </p>
      )}
    </article>
  )
}
