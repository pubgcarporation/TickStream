import { availableParallelism } from 'node:os'

function positiveInt(name: string): number | undefined {
  const value = Math.floor(Number(process.env[name]))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

/**
 * How many videos one media worker encodes at once. Encoding is CPU heavy, so the default is half the cores (at least
 * one, at most four). Set MEDIA_CONCURRENCY to override. Running more copies of the worker adds to this.
 */
export function mediaConcurrency(): number {
  return Math.min(64, positiveInt('MEDIA_CONCURRENCY') ?? Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2))))
}

/** Threads for each ffmpeg run. Unset lets ffmpeg use every core, which is right when jobs run one at a time. */
export function ffmpegThreads(): number | undefined {
  return positiveInt('FFMPEG_THREADS')
}
