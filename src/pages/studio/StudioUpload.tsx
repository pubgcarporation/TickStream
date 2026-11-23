import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { CATEGORIES, DEFAULT_PRICE_PER_SECOND, MAX_PRICE_PER_SECOND, MIN_PRICE_PER_SECOND } from '@shared/constants'
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
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const priceMicro = priceToMicro(price)
  const fileError = file && file.size > MAX_BYTES ? 'That file is over 1 GB.' : null
  const valid = title.trim().length >= 2 && priceMicro !== null && file !== null && !fileError

  const submit = async () => {
    if (!valid || !file || priceMicro === null) return
    setBusy(true)
    try {
      const created = await api<{ id: string }>('videos', {
        method: 'POST',
        body: { title: title.trim(), description: description.trim(), category, priceMicro },
      })
      setProgress(0)
      await uploadSource(created.id, file, setProgress)
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
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
      <Panel className="space-y-5">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-semibold">
            Title
          </label>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className={inputClass} placeholder="Give it a clear name" disabled={busy} />
        </div>
        <div>
          <label htmlFor="description" className="mb-2 block text-sm font-semibold">
            Description
          </label>
          <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={4} className={inputClass} placeholder="What will viewers get for their seconds?" disabled={busy} />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Category</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((item) => (
              <Chip key={item.slug} active={category === item.slug} onClick={() => setCategory(item.slug)} disabled={busy}>
                {item.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold">Video file</p>
          <input ref={fileInput} type="file" accept="video/*" className="sr-only" id="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
            className="glass-inner flex w-full min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-dashed px-4 py-6 text-center text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {file ? (
              <>
                <span className="font-semibold text-[var(--ink)]">{file.name}</span>
                <span className="tabular-nums">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              </>
            ) : (
              <span>Choose a video file (MP4, MOV, WebM, up to 1 GB)</span>
            )}
          </button>
          {fileError && <p className="mt-2 text-sm text-[var(--danger)]">{fileError}</p>}
        </div>
        {progress !== null && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Upload progress">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${progress * 100}%`, transition: 'width 0.2s' }} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-[var(--muted)]">Uploading {Math.round(progress * 100)}%</p>
          </div>
        )}
        <Button full loading={busy} disabled={!valid} onClick={() => void submit()}>
          Upload and publish
        </Button>
      </Panel>

      <Panel className="space-y-4">
        <div>
          <label htmlFor="price" className="mb-2 block text-sm font-semibold">
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
            <p className="mt-2 text-sm text-[var(--danger)]">
              Enter between {formatMicro(MIN_PRICE_PER_SECOND)} and {formatMicro(MAX_PRICE_PER_SECOND)} USDC per second.
            </p>
          )}
        </div>
        {priceMicro !== null && (
          <dl className="glass-inner divide-y divide-[var(--border)] rounded-2xl text-sm tabular-nums">
            <div className="flex justify-between px-4 py-3">
              <dt className="text-[var(--muted)]">One minute</dt>
              <dd>{ratePerMinute(priceMicro)} USDC</dd>
            </div>
            <div className="flex justify-between px-4 py-3">
              <dt className="text-[var(--muted)]">One hour</dt>
              <dd>{ratePerHour(priceMicro)} USDC</dd>
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
