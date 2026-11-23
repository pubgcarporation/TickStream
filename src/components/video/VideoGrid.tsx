import type { VideoSummary } from '@shared/types'
import { Skeleton } from '@/components/ui/primitives'
import { VideoCard } from './VideoCard'

const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-4 gap-y-9'

export function VideoGrid({ videos, loading }: { videos: VideoSummary[] | null; loading?: boolean }) {
  if (loading || !videos) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-video !rounded-xl" />
            <div className="mt-3 flex gap-3">
              <Skeleton className="size-9 shrink-0 !rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        ))}
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
