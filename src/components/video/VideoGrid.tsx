import type { VideoSummary } from '@shared/types'
import { Skeleton } from '@/components/ui/primitives'
import { VideoCard } from './VideoCard'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-4 gap-y-9'
const LEAD_GRID = 'grid gap-x-4 gap-y-9 sm:grid-cols-2 xl:grid-cols-3'

function CardSkeleton() {
  return (
    <div>
      <Skeleton className="aspect-video !rounded-xl" />
      <div className="mt-3 flex gap-3">
        <Skeleton className="size-10 shrink-0 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

/** `lead` shows the first three videos large in a row, then the rest in the regular grid. */
export function VideoGrid({ videos, loading, lead }: { videos: VideoSummary[] | null; loading?: boolean; lead?: boolean }) {
  if (loading || !videos) {
    return (
      <div className={lead ? LEAD_GRID : GRID}>
        {Array.from({ length: lead ? 3 : 8 }, (_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    )
  }
  if (lead && videos.length > 0) {
    const top = videos.slice(0, 3)
    const rest = videos.slice(3)
    return (
      <div className="space-y-9">
        <div className={LEAD_GRID}>
          {top.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} />
          ))}
        </div>
        {rest.length > 0 && (
          <div className={GRID}>
            {rest.map((video, index) => (
              <VideoCard key={video.id} video={video} index={index + 3} />
            ))}
          </div>
        )}
      </div>
    )
  }
  return (
    <div className={GRID}>
      {videos.map((video, index) => (
        <VideoCard key={video.id} video={video} index={index} />
      ))}
    </div>
  )
}
