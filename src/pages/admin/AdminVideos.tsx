import { useState } from 'react'
import { toast } from 'sonner'
import type { VideoSummary } from '@shared/types'
import { Button, EmptyState, Skeleton, inputClass } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { formatMicro, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

export function AdminVideos() {
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const { data, loading, reload } = useApi<{ videos: VideoSummary[] }>(`admin/videos${applied ? `?q=${encodeURIComponent(applied)}` : ''}`)

  const setStatus = async (id: string, status: 'removed' | 'ready') => {
    try {
      await api(`admin/videos/${id}/status`, { method: 'POST', body: { status } })
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update')
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setApplied(q.trim())
        }}
        role="search"
      >
        <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search videos and creators" aria-label="Search videos" className={`${inputClass} max-w-sm rounded-full`} />
      </form>
      {loading && !data ? (
        <Skeleton className="h-48" />
      ) : !data || data.videos.length === 0 ? (
        <EmptyState title="No videos found" />
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {data.videos.map((video) => (
            <li key={video.id} className="flex items-center gap-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <Link to={`/watch/${video.id}`} className="block truncate font-semibold hover:underline">
                  {video.title}
                </Link>
                <p className="text-xs tabular-nums text-[var(--subtle)]">
                  {video.creator.username} · ${formatMicro(video.priceMicro)}/s · {video.views} views · {timeAgo(video.createdAt)}
                </p>
              </div>
              <span className="text-xs font-medium text-[var(--muted)]">{video.status}</span>
              {video.status === 'removed' ? (
                <Button variant="secondary" onClick={() => void setStatus(video.id, 'ready')} className="min-h-9 px-3">
                  Restore
                </Button>
              ) : (
                <Button variant="danger" onClick={() => void setStatus(video.id, 'removed')} className="min-h-9 px-3">
                  Take down
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
