import { Check, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { VideoSummary } from '@shared/types'
import { MAX_PRICE_PER_SECOND, MIN_PRICE_PER_SECOND } from '@shared/constants'
import { Button, EmptyState, Skeleton, inputClass } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { api, thumbnailUrl } from '@/lib/api'
import { formatDuration, formatMicro, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'
import { AmountError, parseUsdc } from '@/onchain-money'

const STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: 'Live', className: 'bg-[var(--success)]/15 text-[var(--success)]' },
  processing: { label: 'Encoding', className: 'bg-white/10 text-[var(--muted)]' },
  uploading: { label: 'Waiting for file', className: 'bg-white/10 text-[var(--muted)]' },
  failed: { label: 'Failed', className: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
}

function VideoRow({ video, onChanged }: { video: VideoSummary; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(formatMicro(video.priceMicro))
  const [saving, setSaving] = useState(false)
  const [broken, setBroken] = useState(false)
  const status = STATUS[video.status] ?? STATUS.uploading

  const save = async () => {
    let micro: number
    try {
      micro = Number(parseUsdc(price))
    } catch (error) {
      if (error instanceof AmountError) {
        toast.error('Enter a valid price')
        return
      }
      throw error
    }
    if (micro < MIN_PRICE_PER_SECOND || micro > MAX_PRICE_PER_SECOND) {
      toast.error('That price is outside the allowed range')
      return
    }
    setSaving(true)
    try {
      await api(`videos/${video.id}`, { method: 'PATCH', body: { priceMicro: micro } })
      setEditing(false)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!window.confirm(`Remove "${video.title}"? Viewers will no longer be able to watch it.`)) return
    try {
      await api(`videos/${video.id}`, { method: 'DELETE' })
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove')
    }
  }

  return (
    <li className="glass flex flex-col gap-4 rounded-3xl p-4 sm:flex-row sm:items-center">
      <div className="glass-inner aspect-video w-full shrink-0 overflow-hidden rounded-2xl sm:w-44">
        {video.status === 'ready' && !broken ? (
          <img src={thumbnailUrl(video.id)} alt="" className="size-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <div className="flex size-full items-center justify-center">
            {video.status === 'processing' && <Loader2 className="size-5 animate-spin text-[var(--subtle)]" aria-label="Encoding" />}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {video.status === 'ready' ? (
            <Link to={`/watch/${video.id}`} className="truncate font-semibold hover:underline">
              {video.title}
            </Link>
          ) : (
            <span className="truncate font-semibold">{video.title}</span>
          )}
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
        </div>
        <p className="mt-1 text-xs tabular-nums text-[var(--subtle)]">
          {formatDuration(video.durationSeconds)} · {video.views} views · {timeAgo(video.createdAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/,/g, '.'))}
              aria-label="Price per second in USDC"
              className={`${inputClass} mono w-28 tabular-nums`}
              inputMode="decimal"
            />
            <Button variant="secondary" loading={saving} onClick={() => void save()} aria-label="Save price" className="px-3">
              <Check className="size-4" />
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)} aria-label="Cancel" className="px-3">
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <>
            <span className="mono text-sm tabular-nums">${formatMicro(video.priceMicro)}/s</span>
            <Button variant="ghost" onClick={() => setEditing(true)} aria-label="Edit price" className="px-3">
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" onClick={() => void remove()} aria-label="Remove video" className="px-3">
              <Trash2 className="size-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

export function StudioVideos() {
  const { data, loading, reload } = useApi<{ videos: VideoSummary[] }>('me/videos')
  const processing = data?.videos.some((video) => video.status === 'processing' || video.status === 'uploading') ?? false

  // Check again every few seconds while anything is still encoding.
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(reload, 4000)
    return () => clearInterval(timer)
  }, [processing, reload])

  if (loading && !data) return <Skeleton className="h-64" />
  if (!data || data.videos.length === 0) {
    return (
      <EmptyState
        title="No videos yet"
        body="Upload a video, set a price per second, and viewers pay you as they watch."
        action={
          <Link to="/studio/upload" className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)]">
            Upload a video
          </Link>
        }
      />
    )
  }
  return (
    <ul className="space-y-3">
      {data.videos.map((video) => (
        <VideoRow key={video.id} video={video} onChanged={reload} />
      ))}
    </ul>
  )
}
