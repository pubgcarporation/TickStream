import { FileVideo, UploadCloud } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CATEGORIES, DEFAULT_PRICE_PER_SECOND, MAX_PREVIEW_SECONDS, MAX_PRICE_PER_SECOND, MIN_PRICE_PER_SECOND } from '@shared/constants'
import { Button, Chip, Panel, inputClass } from '@/components/ui/primitives'
import { api, uploadSource } from '@/lib/api'
import { formatMicro, ratePerHour, ratePerMinute } from '@/lib/format'
import { navigate } from '@/lib/router'
import { AmountError, formatUsdc, parseUsdc } from '@/onchain-money'

const MAX_BYTES = 1024 * 1024 * 1024

function priceToMicro(value: string): number | null {
  try {
    const micro = Number(parseUsdc(value))
    return micro >= MIN_PRICE_PER_SECOND && micro <= MAX_PRICE_PER_SECOND ? micro : null
  } catch (error) {
    if (error instanceof AmountError) return null
    throw error
  }
}

export function StudioUpload() {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('other')
  const [price, setPrice] = useState(formatUsdc(BigInt(DEFAULT_PRICE_PER_SECOND)))
  const [previewSeconds, setPreviewSeconds] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  // If the upload fails after the video was created, retrying reuses it instead of leaving an empty draft behind.
  const draftId = useRef<string | null>(null)

  // Leaving mid-upload would lose the file, so the browser asks first.
  useEffect(() => {
    if (!busy) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])

  /** Takes a chosen or dropped file. A blank title is filled from the file name so it can be changed, not retyped. */
  const pick = (chosen: File | null) => {
    if (!chosen) return
    if (!chosen.type.startsWith('video/')) {
      toast.error('Choose a video file')
      return
    }
    setFile(chosen)
    if (title.trim() === '') {
      const name = chosen.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
      setTitle(name.slice(0, 120))
    }
  }

  const priceMicro = priceToMicro(price)
  const fileError = file && file.size > MAX_BYTES ? 'That file is over 1 GB.' : null
  const valid = title.trim().length >= 2 && priceMicro !== null && file !== null && !fileError

  const submit = async () => {
    if (!valid || !file || priceMicro === null) return
    setBusy(true)
    try {
      if (draftId.current) {
        await api(`videos/${draftId.current}`, {
          method: 'PATCH',
          body: { title: title.trim(), description: description.trim(), category, priceMicro, previewSeconds },
        })
      } else {
        const created = await api<{ id: string }>('videos', {
          method: 'POST',
          body: { title: title.trim(), description: description.trim(), category, priceMicro, previewSeconds },
        })
        draftId.current = created.id
      }
      setProgress(0)
      await uploadSource(draftId.current, file, setProgress)
      draftId.current = null
      toast.success('Uploaded. Encoding now, it will appear in your videos when ready.')
      navigate('/studio/videos')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
      setProgress(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid items-start gap-2.5 lg:grid-cols-[1fr_320px]">
      <Panel className="space-y-3 !p-3.5">
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium">
            Title
          </label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} placeholder="Give it a clear name" disabled={busy} />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} className={inputClass} placeholder="What will viewers get for their seconds?" disabled={busy} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Category</p>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((item) => (
              <Chip key={item.slug} size="sm" active={category === item.slug} onClick={() => setCategory(item.slug)} disabled={busy}>
                {item.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Video file</p>
          <input ref={fileInput} type="file" accept="video/*" className="sr-only" id="file" onChange={(e) => {
              pick(e.target.files?.[0] ?? null)
              e.target.value = ''
            }} disabled={busy} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragging(false)
              pick(event.dataTransfer.files[0] ?? null)
            }}
            disabled={busy}
            className={`flex min-h-24 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-3 text-center text-sm transition-colors ${
              dragging ? 'border-[var(--accent)] bg-white/5 text-[var(--ink)]' : 'border-[#3a3a3a] text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {file ? (
              <>
                <FileVideo className="size-7 text-[var(--accent)]" aria-hidden />
                <span className="max-w-full truncate font-semibold text-[var(--ink)]">{file.name}</span>
                <span className="tabular-nums">{(file.size / 1024 / 1024).toFixed(1)} MB. Click to choose a different file.</span>
              </>
            ) : (
              <>
                <UploadCloud className="size-7" aria-hidden />
                <span className="font-semibold text-[var(--ink)]">Drop a video here or click to browse</span>
                <span>MP4, MOV or WebM, up to 1 GB</span>
              </>
            )}
          </button>
          {fileError && <p className="mt-1.5 text-sm text-[var(--danger)]">{fileError}</p>}
        </div>
        {progress !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress * 100}%`, transition: 'width 0.2s' }} />
            </div>
            <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">Uploading {Math.round(progress * 100)}%</p>
          </div>
        )}
        <Button full loading={busy} disabled={!valid} onClick={() => void submit()}>
          Upload and publish
        </Button>
      </Panel>

      <Panel className="space-y-3 !p-3.5">
        <div>
          <label htmlFor="price" className="mb-1 block text-sm font-medium">
            Price per second (USDC)
          </label>
          <input
            id="price"
            inputMode="decimal"
            value={price}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value.replace(/,/g, '.')
              if (next === '' || /^\d*\.?\d{0,6}$/.test(next)) setPrice(next)
            }}
            className={`${inputClass} mono tabular-nums`}
          />
          {priceMicro === null && (
            <p className="mt-1.5 text-sm text-[var(--danger)]">
              Enter between {formatMicro(MIN_PRICE_PER_SECOND)} and {formatMicro(MAX_PRICE_PER_SECOND)} USDC per second.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="preview" className="mb-1 flex items-center justify-between text-sm font-medium">
            Free preview
            <span className="tabular-nums text-[var(--muted)]">{previewSeconds === 0 ? 'Off' : `${previewSeconds}s`}</span>
          </label>
          <input
            id="preview"
            type="range"
            min={0}
            max={MAX_PREVIEW_SECONDS}
            step={5}
            value={previewSeconds}
            disabled={busy}
            onChange={(e) => setPreviewSeconds(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <p className="mt-1 text-xs text-[var(--subtle)]">The first seconds anyone can watch before paying anything.</p>
        </div>
        {priceMicro !== null && (
          <dl className="divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm tabular-nums">
            <div className="flex justify-between py-1.5">
              <dt className="text-[var(--muted)]">One minute</dt>
              <dd>{ratePerMinute(priceMicro)} USDC</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-[var(--muted)]">One hour</dt>
              <dd>{ratePerHour(priceMicro)} USDC</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-[var(--muted)]">A viewer who watches 10 minutes</dt>
              <dd>{formatMicro(priceMicro * 600)} USDC</dd>
            </div>
          </dl>
        )}
        <p className="text-pretty text-xs text-[var(--subtle)]">
          Viewers pay you directly in USDC as they watch. Your wallet address receives every payment, so connect the wallet you want to be paid to.
        </p>
      </Panel>
    </div>
  )
}
