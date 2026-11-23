import { Loader2, Maximize2, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
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
  onToggle: () => void
  onSeek: (second: number) => void
}

export function PlayerSurface({ videoId, videoRef, view, viewer, durationSeconds, onToggle, onSeek }: PlayerSurfaceProps) {
  const frame = useRef<HTMLDivElement | null>(null)
  const [muted, setMuted] = useState(false)
  const [scrub, setScrub] = useState<number | null>(null)
  const active = view.phase === 'playing' || view.phase === 'needs-funds' || view.phase === 'capped'
  const showPoster = view.phase === 'idle' || view.phase === 'starting' || view.phase === 'ended' || view.phase === 'error'
  const shown = scrub ?? view.position

  const fullscreen = () => {
    const element = frame.current
    if (!element) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void element.requestFullscreen()
  }

  return (
    <div ref={frame} className="group relative aspect-video overflow-hidden rounded-3xl bg-black">
      <video
        ref={videoRef}
        playsInline
        muted={muted}
        disablePictureInPicture
        controlsList="nodownload noremoteplayback"
        onContextMenu={(event) => event.preventDefault()}
        onClick={onToggle}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
          {view.phase === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-9 animate-spin text-white/80" aria-label="Starting" />
            </div>
          )}
        </div>
      )}
      {active && viewer && view.session && <Watermark address={viewer} sessionId={view.session.id} />}
      {view.phase === 'playing' && view.paying && (
        <span className="mono absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-[var(--accent)]">
          Paying next interval
        </span>
      )}
      {active && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <input
            type="range"
            min={0}
            max={Math.max(1, Math.floor(durationSeconds))}
            step={1}
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
            className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
          />
          <div className="mt-2 flex items-center gap-3 text-white">
            <button onClick={onToggle} aria-label={view.paused ? 'Play' : 'Pause'} className="flex size-11 items-center justify-center rounded-full hover:bg-white/15">
              {view.paused ? <Play className="size-5" /> : <Pause className="size-5" />}
            </button>
            <span className="mono text-xs tabular-nums">
              {formatDuration(shown)} / {formatDuration(durationSeconds)}
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
