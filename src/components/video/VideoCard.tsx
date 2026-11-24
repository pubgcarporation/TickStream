import { MoreVertical } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { CATEGORIES } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { Avatar } from '@/components/ui/Avatar'
import { useShareLink } from '@/hooks/useShareLink'
import { thumbnailUrl } from '@/lib/api'
import { compactNumber, formatDuration, formatMicro, timeAgo } from '@/lib/format'
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
      className="-mr-2 flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--ink)] opacity-0 transition-opacity hover:bg-white/10 focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden max-lg:size-10 max-lg:opacity-100"
    >
      <MoreVertical className="size-5" aria-hidden />
    </button>
  )
}

export function VideoCard({ video, index = 0 }: { video: VideoSummary; index?: number }) {
  const [failed, setFailed] = useState(false)
  const category = CATEGORIES.find((c) => c.slug === video.category)?.label ?? 'Other'
  const name = video.creator.displayName ?? video.creator.username
  const fullCost = video.durationSeconds ? video.priceMicro * video.durationSeconds : null
  return (
    <article className="group rise" style={{ ['--i' as string]: Math.min(index, 8) }}>
      <Link to={`/watch/${video.id}`} className="block max-[559px]:-mx-4" aria-label={`Watch ${video.title}`}>
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[#272727] transition-[border-radius] duration-200 group-hover:rounded-none max-[559px]:rounded-none">
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
          <div className="absolute bottom-2 left-2">
            <PriceTag priceMicro={video.priceMicro} />
          </div>
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-semibold tabular-nums">
            {formatDuration(video.durationSeconds)}
          </span>
        </div>
      </Link>
      <div className="mt-2.5 flex gap-3 sm:mt-3">
        <Link to={`/profile/${video.creator.username}`} aria-label={`${name}'s profile`} className="shrink-0">
          <Avatar name={name} size={40} username={video.creator.username} version={video.creator.avatarVersion} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link to={`/watch/${video.id}`} className="line-clamp-2 text-pretty text-base font-semibold leading-snug">
            {video.title}
          </Link>
          <Link to={`/profile/${video.creator.username}`} className="mt-1 block truncate text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            {name}
          </Link>
          <p className="truncate text-sm tabular-nums text-[var(--muted)]">
            {compactNumber(video.views)} views · {timeAgo(video.createdAt)}
          </p>
          {fullCost !== null && (
            <p className="truncate text-xs tabular-nums text-[var(--subtle)]">
              {category} · About ${formatMicro(fullCost)} to watch it all
            </p>
          )}
        </div>
        <CopyLinkButton path={`/watch/${video.id}`} />
      </div>
    </article>
  )
}
