import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { VideoSummary } from '@shared/types'
import { toast } from 'sonner'
import { Button, Chip, EmptyState, PageHeader, inputClass } from '@/components/ui/primitives'
import { CategoryChips } from '@/components/video/CategoryChips'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { navigate, useLocation } from '@/lib/router'

const SORTS = [
  { value: 'new', label: 'Newest' },
  { value: 'trending', label: 'Trending' },
  { value: 'price', label: 'Cheapest' },
]

export function ExplorePage() {
  const { search } = useLocation()
  const sort = search.get('sort') ?? 'new'
  const category = search.get('category') ?? ''
  const q = search.get('q') ?? ''
  const [draft, setDraft] = useState(q)

  useEffect(() => {
    const timer = setTimeout(() => setDraft(q), 0)
    return () => clearTimeout(timer)
  }, [q])

  const update = (changes: Record<string, string>) => {
    const next = new URLSearchParams(search)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    navigate(query ? `/explore?${query}` : '/explore', { replace: true })
  }

  const PAGE = 48
  const params = new URLSearchParams({ sort, limit: String(PAGE) })
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  const { data, loading, error, reload } = useApi<{ videos: VideoSummary[] }>(`videos?${params.toString()}`)
  const filterKey = params.toString()
  const [extra, setExtra] = useState<{ key: string; videos: VideoSummary[]; done: boolean }>({ key: filterKey, videos: [], done: false })
  const [loadingMore, setLoadingMore] = useState(false)
  // Extra pages belong to one set of filters; changing the filters starts over.
  const more = extra.key === filterKey ? extra : { key: filterKey, videos: [], done: false }
  const videos = data ? [...data.videos, ...more.videos] : null
  const canLoadMore = data !== null && data.videos.length === PAGE && !more.done

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const next = new URLSearchParams(params)
      next.set('offset', String(PAGE + more.videos.length))
      const result = await api<{ videos: VideoSummary[] }>(`videos?${next.toString()}`)
      setExtra({ key: filterKey, videos: [...more.videos, ...result.videos], done: result.videos.length < PAGE })
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : 'Could not load more videos')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Explore"
        subtitle={q ? `Results for "${q}"` : 'Every video shows its price per second.'}
        actions={
          <form
            onSubmit={(event) => {
              event.preventDefault()
              update({ q: draft.trim() })
            }}
            className="relative w-full min-w-[min(100%,18rem)] sm:w-80"
            role="search"
          >
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[var(--subtle)]" aria-hidden />
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search titles and creators"
              aria-label="Search videos"
              className={`${inputClass} rounded-full pl-10`}
            />
          </form>
        }
      />

      <CategoryChips value={category} onChange={(slug) => update({ category: slug })} />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort">
          {SORTS.map((item) => (
            <Chip key={item.value} active={sort === item.value} onClick={() => update({ sort: item.value })}>
              {item.label}
            </Chip>
          ))}
        </div>
        {videos && videos.length > 0 && (
          <p className="text-xs tabular-nums text-[var(--subtle)]">
            {videos.length}
            {canLoadMore ? '+' : ''} {videos.length === 1 ? 'video' : 'videos'}
          </p>
        )}
      </div>

      {videos && videos.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={q || category ? 'No videos match those filters. Try clearing them.' : 'No videos have been published yet.'}
        />
      ) : (
        <VideoGrid videos={videos} loading={loading} error={error} onRetry={reload} />
      )}
      {canLoadMore && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
            Show more
          </Button>
        </div>
      )}
    </div>
  )
}
