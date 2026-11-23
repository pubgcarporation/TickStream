import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CATEGORIES } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { Chip, EmptyState, inputClass } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
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

  const params = new URLSearchParams({ sort, limit: '48' })
  if (category) params.set('category', category)
  if (q) params.set('q', q)
  const { data, loading } = useApi<{ videos: VideoSummary[] }>(`videos?${params.toString()}`)

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <h1 className="display text-4xl font-bold">Explore</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            update({ q: draft.trim() })
          }}
          className="relative w-full lg:max-w-sm"
          role="search"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[var(--subtle)]" aria-hidden />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search titles and creators"
            aria-label="Search videos"
            className={`${inputClass} pl-11`}
          />
        </form>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {SORTS.map((item) => (
          <Chip key={item.value} active={sort === item.value} onClick={() => update({ sort: item.value })}>
            {item.label}
          </Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-[var(--border)]" aria-hidden />
        <Chip active={category === ''} onClick={() => update({ category: '' })}>
          All
        </Chip>
        {CATEGORIES.map((item) => (
          <Chip key={item.slug} active={category === item.slug} onClick={() => update({ category: item.slug })}>
            {item.label}
          </Chip>
        ))}
      </div>

      {data && data.videos.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body={q || category ? 'No videos match those filters. Try clearing them.' : 'No videos have been published yet.'}
        />
      ) : (
        <VideoGrid videos={data?.videos ?? null} loading={loading} />
      )}
    </div>
  )
}
