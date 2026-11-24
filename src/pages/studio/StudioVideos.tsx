import { AlertTriangle, Check, Clapperboard, Loader2, Pencil, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { VideoSummary } from '@shared/types'
import { CATEGORIES, MAX_PREVIEW_SECONDS, MAX_PRICE_PER_SECOND, MIN_PRICE_PER_SECOND } from '@shared/constants'
import { usdc } from '@/components/studio/bits'
import { Block } from '@/components/studio/Block'
import { useStudioRange, useStudioStats } from '@/components/studio/useStudioStats'
import { Button, Chip, EmptyState, ErrorState, Sheet, Skeleton, inputClass } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { formatDuration, formatMicro, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'
import { AmountError, parseUsdc } from '@/onchain-money'
import { VideoThumb } from './StudioOverview'

const STATUS: Record<string, { label: string; className: string }> = {
  ready: { label: 'Live', className: 'bg-[var(--success)]/15 text-[var(--success)]' },
  processing: { label: 'Encoding', className: 'bg-[var(--warn)]/15 text-[var(--warn)]' },
  uploading: { label: 'Waiting for file', className: 'bg-white/10 text-[var(--muted)]' },
  failed: { label: 'Failed', className: 'bg-[var(--danger)]/15 text-[var(--danger)]' },
}

type Filter = 'all' | 'ready' | 'working' | 'failed'
const FILTERS: Array<{ key: Filter; label: string; test: (v: VideoSummary) => boolean }> = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'ready', label: 'Live', test: (v) => v.status === 'ready' },
  { key: 'working', label: 'Encoding', test: (v) => v.status === 'processing' || v.status === 'uploading' },
  { key: 'failed', label: 'Failed', test: (v) => v.status === 'failed' },
]

function DetailsSheet({ video, open, onClose, onSaved }: { video: VideoSummary; open: boolean; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(video.title)
  const [description, setDescription] = useState(video.description)
  const [category, setCategory] = useState(video.category)
  const [preview, setPreview] = useState(video.previewSeconds)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api(`videos/${video.id}`, { method: 'PATCH', body: { title, description, category, previewSeconds: preview } })
      toast.success('Details saved')
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Video details">
      <div className="space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label="Title" className={inputClass} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} aria-label="Description" className={inputClass} />
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((item) => (
            <Chip key={item.slug} active={category === item.slug} onClick={() => setCategory(item.slug)}>
              {item.label}
            </Chip>
          ))}
        </div>
        <div>
          <label htmlFor="edit-preview" className="mb-2 flex items-center justify-between text-sm font-semibold">
            Free preview
            <span className="tabular-nums text-[var(--muted)]">{preview === 0 ? 'Off' : `${preview}s`}</span>
          </label>
          <input
            id="edit-preview"
            type="range"
            min={0}
            max={MAX_PREVIEW_SECONDS}
            step={5}
            value={preview}
            onChange={(e) => setPreview(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
        </div>
        <Button full loading={saving} disabled={title.trim().length < 2} onClick={() => void save()}>
          Save details
        </Button>
      </div>
    </Sheet>
  )
}

function VideoRow({ video, earnedMicro, onChanged }: { video: VideoSummary; earnedMicro: number; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(formatMicro(video.priceMicro))
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
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
      toast.success('Price updated')
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
      toast.success('Video removed')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove')
    }
  }

  return (
    <li className="grid items-center gap-x-3 gap-y-2 px-3.5 py-2.5 text-[13px] sm:grid-cols-[minmax(0,1fr)_92px_80px_64px_88px_112px]">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative w-20 shrink-0 sm:w-24">
          {video.status === 'ready' ? (
            <VideoThumb videoId={video.id} className="w-full" />
          ) : (
            <span className="flex aspect-video w-full items-center justify-center rounded bg-[#2a2a2a]">
              {video.status === 'processing' && <Loader2 className="size-4 animate-spin text-[var(--subtle)]" aria-label="Encoding" />}
              {video.status === 'failed' && <AlertTriangle className="size-4 text-[var(--danger)]" aria-label="Failed" />}
            </span>
          )}
          {video.durationSeconds ? (
            <span className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[10px] font-medium tabular-nums">{formatDuration(video.durationSeconds)}</span>
          ) : null}
        </div>
        <div className="min-w-0">
          {video.status === 'ready' ? (
            <Link to={`/watch/${video.id}`} className="block truncate font-medium hover:underline">
              {video.title}
            </Link>
          ) : (
            <span className="block truncate font-medium">{video.title}</span>
          )}
          <p className="truncate text-[11px] text-[var(--subtle)]">
            {timeAgo(video.createdAt)} &bull; {video.previewSeconds > 0 ? `${video.previewSeconds}s free preview` : 'No free preview'}
          </p>
          {video.status === 'failed' && video.error && <p className="mt-0.5 line-clamp-2 text-pretty text-[11px] text-[var(--danger)]">{video.error}</p>}
        </div>
      </div>

      <span className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>

      <div className="flex items-center gap-1 tabular-nums">
        {editing ? (
          <>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/,/g, '.'))}
              aria-label="Price per second in USDC"
              className={`${inputClass} mono !h-8 !w-24 !px-2 !py-1 text-[13px]`}
              inputMode="decimal"
            />
            <button type="button" onClick={() => void save()} disabled={saving} aria-label="Save price" className="flex size-8 items-center justify-center rounded-full hover:bg-white/10">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-[var(--success)]" />}
            </button>
            <button type="button" onClick={() => setEditing(false)} aria-label="Cancel" className="flex size-8 items-center justify-center rounded-full hover:bg-white/10">
              <X className="size-4" />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setEditing(true)} aria-label="Edit price" className="group mono -ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:bg-white/10">
            ${formatMicro(video.priceMicro)}/s <Pencil className="size-3 text-[var(--subtle)] opacity-0 group-hover:opacity-100 max-sm:opacity-100" aria-hidden />
          </button>
        )}
      </div>

      <span className="text-[var(--muted)] tabular-nums sm:text-right">
        <span className="text-[11px] sm:hidden">Views </span>
        {video.views}
      </span>
      <span className="font-semibold tabular-nums sm:text-right" title="Earned in the selected period">
        <span className="text-[11px] font-normal text-[var(--subtle)] sm:hidden">Earned </span>
        {usdc(earnedMicro)}
      </span>

      <div className="flex items-center justify-end gap-0.5">
        <button type="button" onClick={() => setDetailsOpen(true)} aria-label="Edit title, description and preview" className="flex size-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/10 hover:text-[var(--ink)]">
          <SlidersHorizontal className="size-4" />
        </button>
        <button type="button" onClick={() => void remove()} aria-label="Remove video" className="flex size-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-white/10 hover:text-[var(--danger)]">
          <Trash2 className="size-4" />
        </button>
      </div>
      {detailsOpen && <DetailsSheet video={video} open={detailsOpen} onClose={() => setDetailsOpen(false)} onSaved={onChanged} />}
    </li>
  )
}

export function StudioVideos() {
  const { data, loading, error, reload } = useApi<{ videos: VideoSummary[] }>('me/videos')
  const [days] = useStudioRange()
  const stats = useStudioStats(days)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const processing = data?.videos.some((video) => video.status === 'processing' || video.status === 'uploading') ?? false

  // Check again every few seconds while anything is still encoding.
  useEffect(() => {
    if (!processing) return
    const timer = setInterval(reload, 4000)
    return () => clearInterval(timer)
  }, [processing, reload])

  const earned = useMemo(() => new Map((stats.stats?.videos ?? []).map((video) => [video.videoId, video.watchMicro + video.tipsMicro])), [stats.stats])
  const shown = useMemo(() => {
    const test = FILTERS.find((item) => item.key === filter)?.test ?? (() => true)
    const term = search.trim().toLowerCase()
    return (data?.videos ?? []).filter((video) => test(video) && (!term || video.title.toLowerCase().includes(term)))
  }, [data, filter, search])

  if (loading && !data) return <Skeleton className="h-64" />
  if (error && !data) return <ErrorState title="Could not load your videos" message={error.message} onRetry={reload} />
  if (!data || data.videos.length === 0) {
    return (
      <EmptyState
        icon={Clapperboard}
        title="No videos yet"
        body="Upload a video, set a price per second, and viewers pay you as they watch."
        action={
          <Link to="/studio/upload" className="inline-flex min-h-10 items-center rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)]">
            Upload a video
          </Link>
        }
      />
    )
  }
  const counts = (test: (v: VideoSummary) => boolean) => data.videos.filter(test).length
  return (
    <Block
      title={`Videos (${data.videos.length})`}
      action={
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--subtle)]" aria-hidden />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your videos" aria-label="Search your videos" className={`${inputClass} !h-8 !w-44 !rounded-full !py-1 !pl-8 !pr-3 text-xs sm:!w-56`} />
        </label>
      }
    >
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--border)] px-3.5 py-2" role="group" aria-label="Filter videos">
        {FILTERS.map((item) => (
          <Chip key={item.key} size="sm" active={filter === item.key} onClick={() => setFilter(item.key)}>
            {item.label} <span className="tabular-nums opacity-60">{counts(item.test)}</span>
          </Chip>
        ))}
      </div>
      <div className="hidden grid-cols-[minmax(0,1fr)_92px_80px_64px_88px_112px] gap-x-3 border-b border-[var(--border)] px-3.5 py-1.5 text-[11px] font-medium text-[var(--subtle)] sm:grid">
        <span>Video</span>
        <span>Status</span>
        <span>Price</span>
        <span className="text-right">Views</span>
        <span className="text-right" title="Earned in the period chosen on Overview">
          Earned
        </span>
        <span />
      </div>
      {shown.length === 0 ? (
        <p className="px-3.5 py-8 text-center text-[13px] text-[var(--muted)]">No videos match.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {shown.map((video) => (
            <VideoRow key={video.id} video={video} earnedMicro={earned.get(video.id) ?? 0} onChanged={reload} />
          ))}
        </ul>
      )}
    </Block>
  )
}
