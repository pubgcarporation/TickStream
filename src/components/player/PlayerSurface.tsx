import { Loader2, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useRef, useState, type CSSProperties, type KeyboardEvent, type RefObject } from 'react'
import { AnimatedAmount } from '@/components/ui/AnimatedAmount'
import { thumbnailUrl } from '@/lib/api'
import { formatDuration } from '@/lib/format'
import type { PlaybackView } from './usePaidPlayback'
import { Watermark } from './Watermark'

interface PlayerSurfaceProps {
  videoId: string
  videoRef: RefObject<HTMLVideoElement>
  view: PlaybackView
  viewer: string | undefined
  durationSeconds: number
  /** Cost of what has been watched so far, in USDC base units. */
  costMicro: number
  onToggle: () => void
  onSeek: (second: number) => void
  /** Starts the session from the poster. Shown only when it can run right away. */
  onStart?: () => void
  /** Shown on the player when the balance runs out. */
  onAddFunds?: () => void
  onRetry?: () => void
  className?: string
}

export function PlayerSurface({ videoId, videoRef, view, viewer, durationSeconds, costMicro, onToggle, onSeek, onStart, onAddFunds, onRetry, className }: PlayerSurfaceProps) {
  const frame = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const [buffering, setBuffering] = useState(false)
  const active = view.phase === 'playing' || view.phase === 'needs-funds' || view.phase === 'capped'
  const showPoster = view.phase === 'idle' || view.phase === 'starting' || view.phase === 'ended' || view.phase === 'error'
  const shown = scrub ?? view.position
  const metering = view.phase === 'playing' && !view.paused

  const fullscreen = () => {
    const element = frame.current
    if (!element) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void element.requestFullscreen()
  }

  // Space or K plays and pauses, arrows jump ten seconds, M mutes, F goes fullscreen.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!active || event.target instanceof HTMLInputElement) return
    const key = event.key.toLowerCase()
    if (key === ' ' || key === 'k') onToggle()
    else if (key === 'm') setMuted((value) => !value)
    else if (key === 'f') fullscreen()
    else if (key === 'arrowright') onSeek(Math.min(durationSeconds, view.position + 10))
    else if (key === 'arrowleft') onSeek(Math.max(0, view.position - 10))
    else return
    event.preventDefault()
  }

  return (
    <div
      ref={frame}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Video player. Space plays or pauses, arrow keys skip ten seconds."
      className={`group relative aspect-video overflow-hidden rounded-xl bg-black focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${className ?? ''}`}
    >
      <video
        ref={videoRef}
        playsInline
        muted={muted}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        onContextMenu={(event) => event.preventDefault()}
        onClick={onToggle}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        className="size-full object-contain"
      />
      {showPoster && (
        <div className="absolute inset-0">
          <img
            src={thumbnailUrl(videoId)}
            alt=""
            className="size-full object-cover opacity-60"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
          {view.phase === 'starting' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-9 animate-spin text-white/80" aria-hidden />
              <p className="text-sm text-white/80">Starting your session...</p>
            </div>
          ) : (
            view.phase === 'idle' && (
              <button
                type="button"
                onClick={onStart}
                disabled={!onStart}
                aria-label={onStart ? 'Start watching' : 'Start a session below to watch'}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 disabled:cursor-default"
              >
                <span className="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-lg shadow-black/40 transition-transform enabled:group-hover:scale-105">
                  <Play className="size-7 translate-x-0.5 fill-black text-black" />
                </span>
                <span className="rounded-md bg-black/60 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                  {onStart ? 'Start watching' : 'Start a session below to watch'}
                </span>
              </button>
            )
          )}
        </div>
      )}
      {active && viewer && view.session && <Watermark address={viewer} sessionId={view.session.id} />}

      {active && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 sm:hidden rounded-md bg-black/65 px-2.5 py-1.5 backdrop-blur" aria-live="off">
          <span className={`size-1.5 rounded-full ${metering ? 'bg-[var(--success)]' : 'bg-[var(--subtle)]'}`} aria-hidden />
          <span className="mono text-xs tabular-nums text-white">
            $<AnimatedAmount micro={costMicro} />
          </span>
          {view.paying && <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">Paying</span>}
        </div>
      )}

      {(view.phase === 'needs-funds' || view.phase === 'capped') && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center backdrop-blur-sm">
          <p className="max-w-sm text-pretty text-sm font-medium text-white">
            {view.phase === 'capped' ? 'Your spending balance for this session is used up.' : 'Your spending balance is too low to keep going.'}
          </p>
          <div className="flex gap-2">
            {onAddFunds && (
              <button type="button" onClick={onAddFunds} className="min-h-10 rounded-lg bg-white px-4 text-sm font-semibold text-black hover:bg-white/90">
                Add money
              </button>
            )}
            {onRetry && (
              <button type="button" onClick={onRetry} className="min-h-10 rounded-lg bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25">
                {view.phase === 'capped' ? 'Continue' : 'Retry'}
              </button>
            )}
          </div>
        </div>
      )}
      {view.phase === 'playing' && buffering && !view.paused && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-10 animate-spin text-white/80" aria-label="Buffering" />
        </div>
      )}
      {view.phase === 'playing' && view.paused && (
        <button onClick={onToggle} aria-label="Play" className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex size-16 items-center justify-center rounded-full bg-white/90 shadow-lg shadow-black/40 transition-transform hover:scale-105">
            <Play className="size-7 translate-x-0.5 fill-black text-black" />
          </span>
        </button>
      )}

      {active && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2 pt-12 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${
            view.paused ? 'opacity-100' : 'opacity-100 sm:opacity-0'
          }`}
        >
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(durationSeconds))}
            step={1}
            style={{ '--pct': `${Math.min(100, (shown / Math.max(1, durationSeconds)) * 100)}%` } as CSSProperties}
            value={Math.floor(shown)}
            onChange={(event) => setScrub(Number(event.target.value))}
            onPointerUp={() => {
              if (scrub !== null) onSeek(scrub)
              setScrub(null)
            }}
            onKeyUp={() => {
              if (scrub !== null) onSeek(scrub)
              setScrub(null)
            }}
            aria-label="Seek"
            className="scrubber"
          />
          <div className="mt-1 flex items-center gap-1 text-white">
            <button onClick={onToggle} aria-label={view.paused ? 'Play' : 'Pause'} className="flex size-11 items-center justify-center rounded-full hover:bg-white/15">
              {view.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            <span className="ml-1 text-xs font-medium tabular-nums">
              {formatDuration(shown)} <span className="text-white/60">/ {formatDuration(durationSeconds)}</span>
            </span>
            <button
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className="ml-auto flex size-11 items-center justify-center rounded-full hover:bg-white/15"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <button onClick={fullscreen} aria-label="Fullscreen" className="flex size-11 items-center justify-center rounded-full hover:bg-white/15">
              <Maximize2 className="size-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
