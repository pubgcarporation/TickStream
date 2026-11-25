import type { VideoSummary } from '@shared/types'
import { useApi } from '@/hooks/useApi'
import { thumbnailUrl } from '@/lib/api'
import { creatorLabel, formatDuration, formatMicro, timeAgoLong, viewsLabel } from '@/lib/format'
import { Link } from '@/lib/router'

export function RelatedVideos({ videoId }: { videoId: string }) {
  const { data } = useApi<{ videos: VideoSummary[] }>(`videos/${videoId}/related`)
  if (!data || data.videos.length === 0) return null
  return (
    <section aria-labelledby="related-title" className="space-y-2">
      <h2 id="related-title" className="text-base font-bold">
        Up next
      </h2>
      <ul className="space-y-2.5">
        {data.videos.map((video) => (
          <li key={video.id}>
            <Link to={`/watch/${video.id}`} className="group flex gap-2">
              <div className="thumb relative aspect-video w-40 shrink-0 sm:w-[168px] overflow-hidden rounded-lg bg-[#2a2a2a]">
                <img src={thumbnailUrl(video.id)} alt="" loading="lazy" className="size-full object-cover" />
                {video.durationSeconds ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 text-[11px] font-medium tabular-nums">{formatDuration(video.durationSeconds)}</span>
                ) : null}
                <span className="mono absolute bottom-1 left-1 rounded bg-black/80 px-1 py-0.5 text-[10px] font-medium tabular-nums">${formatMicro(video.priceMicro)}/s</span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-pretty text-sm font-medium leading-5">{video.title}</p>
                <p className="mt-1 truncate text-xs text-[var(--muted)]">{creatorLabel(video.creator)}</p>
                <p className="truncate text-xs tabular-nums text-[var(--muted)]">
                  {viewsLabel(video.views)} <span aria-hidden>&bull;</span> {timeAgoLong(video.createdAt)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
