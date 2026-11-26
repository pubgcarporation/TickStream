import { useRef, useState, type PointerEvent } from 'react'
import { formatDuration } from '@/lib/format'

interface PlayerProgressProps {
  /** Seconds played so far. */
  position: number
  /** End of the video that is paid for. Drawn as a lighter bar ahead of the played part, like YouTube's buffer. */
  paidEnd: number
  duration: number
  /** Called while the viewer drags, and with null when the drag ends. */
  onPreview: (second: number | null) => void
  onCommit: (second: number) => void
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

/** A thin line along the bottom edge of the video that thickens on hover, with a time tooltip and a drag handle. */
export function PlayerProgress({ position, paidEnd, duration, onPreview, onCommit }: PlayerProgressProps) {
  const bar = useRef<HTMLDivElement | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [drag, setDrag] = useState<number | null>(null)
  const total = Math.max(1, duration)
  const shown = drag ?? position

  const secondAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = bar.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp((event.clientX - rect.left) / rect.width, 0, 1) * total
  }
  const percent = (second: number) => `${clamp((second / total) * 100, 0, 100)}%`

  const finish = (event: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (drag === null) return
    const second = secondAt(event)
    setDrag(null)
    onPreview(null)
    if (commit) onCommit(second)
  }

  return (
    <div
      ref={bar}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.floor(total)}
      aria-valuenow={Math.floor(shown)}
      aria-valuetext={`${formatDuration(shown)} of ${formatDuration(total)}`}
      className="group/bar absolute inset-x-0 bottom-0 z-10 h-5 cursor-pointer touch-none select-none"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const second = secondAt(event)
        setDrag(second)
        onPreview(second)
      }}
      onPointerMove={(event) => {
        const second = secondAt(event)
        setHover(second)
        if (drag !== null) {
          setDrag(second)
          onPreview(second)
        }
      }}
      onPointerUp={(event) => finish(event, true)}
      onPointerCancel={(event) => finish(event, false)}
      onPointerLeave={() => setHover(null)}
    >
      {(hover !== null || drag !== null) && (
        <div
          className="pointer-events-none absolute bottom-5 -translate-x-1/2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white"
          style={{ left: percent(drag ?? hover ?? 0) }}
        >
          {formatDuration(drag ?? hover ?? 0)}
        </div>
      )}
      <div className={`absolute inset-x-0 bottom-0 bg-white/25 transition-[height] ${drag !== null ? 'h-[5px]' : 'h-[3px] group-hover/bar:h-[5px]'}`}>
        <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: percent(paidEnd) }} />
        <div className="absolute inset-y-0 left-0 bg-[var(--accent)]" style={{ width: percent(shown) }} />
        <div
          className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] transition-transform ${drag !== null ? 'scale-100' : 'scale-0 group-hover/bar:scale-100'}`}
          style={{ left: percent(shown) }}
        />
      </div>
    </div>
  )
}
