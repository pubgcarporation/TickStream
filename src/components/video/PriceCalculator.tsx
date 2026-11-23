import { useState } from 'react'
import type { VideoSummary } from '@shared/types'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { Chip } from '@/components/ui/primitives'
import { formatDuration, formatMicro } from '@/lib/format'
import { Link } from '@/lib/router'

/** Lets a visitor feel per-second pricing: drag the time and see the exact cost for a real video. */
export function PriceCalculator({ video }: { video: VideoSummary }) {
  const full = Math.max(10, Math.floor(video.durationSeconds ?? 60))
  const [seconds, setSeconds] = useState(Math.min(60, full))
  const presets = [30, 60, 300, full].filter((value, index, all) => value <= full && all.indexOf(value) === index)

  return (
    <div className="glass rise rounded-3xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">What your time costs</p>
      <p className="display mt-4 text-6xl font-bold leading-none tabular-nums">
        <span className="mr-1 text-3xl font-medium text-[var(--subtle)]">$</span>
        <AnimatedAmount micro={video.priceMicro * seconds} />
      </p>
      <p className="mt-3 text-sm tabular-nums text-[var(--muted)]">
        {formatDuration(seconds)} of{' '}
        <Link to={`/watch/${video.id}`} className="font-semibold text-[var(--ink)] underline-offset-4 hover:underline">
          {video.title}
        </Link>{' '}
        at ${formatMicro(video.priceMicro)} per second.
      </p>
      <input
        type="range"
        min={1}
        max={full}
        step={1}
        value={seconds}
        onChange={(event) => setSeconds(Number(event.target.value))}
        aria-label="Seconds watched"
        className="mt-6 h-1.5 w-full cursor-pointer accent-[var(--accent)]"
      />
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Quick durations">
        {presets.map((value) => (
          <Chip key={value} active={seconds === value} onClick={() => setSeconds(value)}>
            {value === full ? 'Whole video' : formatDuration(value)}
          </Chip>
        ))}
      </div>
      <p className="mt-5 text-xs text-[var(--subtle)]">Pause or close the tab and the meter stops.</p>
    </div>
  )
}
