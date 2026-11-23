import type { VideoSummary } from '@shared/types'
import { useApi } from '@/hooks/useApi'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro } from '@/lib/format'
import { Link } from '@/lib/router'

export function RelatedVideos({ videoId }: { videoId: string }) {
  const { data } = useApi<{ videos: VideoSummary[] }>(`videos/${videoId}/related`)
  if (!data || data.videos.length === 0) return null
  return (
    <section aria-labelledby="related-title" className="space-y-3">
      <h2 id="related-title" className="text-base font-semibold">
        Up next
      </h2>
      <ul className="space-y-2.5">
        {data.videos.map((video) => (
          <li key={video.id}>
            <Link to={`/watch/${video.id}`} className="group flex gap-3">
              <div className="aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-[#272727]">
                <img src={thumbnailUrl(video.id)} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{video.title}</p>
                <p className="mt-1 text-xs text-[var(--subtle)]">{video.creator.displayName ?? video.creator.username}</p>
                <p className="mono mt-1 text-[11px] tabular-nums text-[var(--muted)]">
                  ${formatMicro(video.priceMicro)}/s · {formatDuration(video.durationSeconds)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
