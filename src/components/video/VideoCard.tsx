import { Film, MoreVertical, Play } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { VideoSummary } from '@shared/types'
import { Avatar } from '@/components/ui/Avatar'
import { useShareLink } from '@/hooks/useShareLink'
import { thumbnailUrl } from '@/lib/api'
import { creatorLabel, formatDuration, formatMicro, timeAgoLong, viewsLabel } from '@/lib/format'
import { Link } from '@/lib/router'

export function PriceTag({ priceMicro }: { priceMicro: number }) {
  return (
    <span className="mono rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums">${formatMicro(priceMicro)}/s</span>
  )
}

/** The three-dot menu on a card. It copies a link to the video that works outside the preview. */
function CopyLinkButton({ path }: { path: string }) {
  const link = useShareLink(path)
  return (
    <button
      type="button"
      disabled={!link}
      onClick={() => {
        if (!link) return
        navigator.clipboard.writeText(link).then(
          () => toast.success('Link copied'),
          () => toast.error('Could not copy the link'),
        )
      }}
      aria-label="Copy link"
      title="Copy link"
      className="-mr-2 flex size-10 shrink-0 items-center justify-center rounded-full text-[var(--ink)] opacity-0 transition-opacity hover:bg-white/10 focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden max-lg:opacity-100"
    >
      <MoreVertical className="size-5" aria-hidden />
    </button>
  )
}

/**
 * The video card, laid out like a video site's: a 16:9 thumbnail with the length in its corner, then the channel
 * picture beside the title, the creator's name, and "views, age". The price per second and any free preview sit on
 * the thumbnail, since that is the one thing here a video site would not have.
 */
export function VideoCard({ video, index = 0 }: { video: VideoSummary; index?: number }) {
  const [failed, setFailed] = useState(false)
  const name = creatorLabel(video.creator)
  return (
    <article className="group rise" style={{ ['--i' as string]: Math.min(index, 8) }}>
      <Link to={`/watch/${video.id}`} className="block max-[559px]:-mx-4" aria-label={`Watch ${video.title}`}>
        <div className="thumb relative aspect-video overflow-hidden rounded-xl bg-[#2a2a2a] transition-[border-radius] duration-200 max-[559px]:rounded-none">
          {failed ? (
            <div className="flex size-full flex-col items-center justify-center gap-1 text-xs text-[var(--subtle)]">
              <Film className="size-6 opacity-60" aria-hidden />
              No preview
            </div>
          ) : (
            <img src={thumbnailUrl(video.id)} alt="" loading="lazy" onError={() => setFailed(true)} className="size-full object-cover" />
          )}
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/25 group-hover:opacity-100 max-lg:hidden"
            aria-hidden
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-white/90 shadow-lg shadow-black/40">
              <Play className="size-5 translate-x-0.5 fill-black text-black" />
            </span>
          </span>
          {video.previewSeconds > 0 && (
            <span className="absolute left-2 top-2 rounded bg-[var(--accent)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-ink)]">
              {video.previewSeconds}s free
            </span>
          )}
          <div className="absolute bottom-2 left-2">
            <PriceTag priceMicro={video.priceMicro} />
          </div>
          {video.durationSeconds ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums">{formatDuration(video.durationSeconds)}</span>
          ) : null}
        </div>
      </Link>
      <div className="mt-3 flex gap-3">
        <Link to={`/profile/${video.creator.username}`} aria-label={`${name}'s profile`} className="shrink-0">
          <Avatar name={name} size={36} username={video.creator.username} version={video.creator.avatarVersion} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/watch/${video.id}`} className="line-clamp-2 text-pretty text-base font-medium leading-[22px]">
            {video.title}
          </Link>
          <Link to={`/profile/${video.creator.username}`} className="mt-1 block truncate text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            {name}
          </Link>
          <p className="truncate text-sm tabular-nums text-[var(--muted)]">
            {viewsLabel(video.views)} <span aria-hidden>&bull;</span> {timeAgoLong(video.createdAt)}
          </p>
        </div>
        <CopyLinkButton path={`/watch/${video.id}`} />
      </div>
    </article>
  )
}
