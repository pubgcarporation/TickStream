import type { PlaybackView } from './usePaidPlayback'

/** What the viewer has actually consumed, in USDC base units. The free preview is never billed. */
export function billedMicro(view: PlaybackView, priceMicro: number): number {
  return Math.round(priceMicro * Math.max(0, view.playedSeconds - view.freeSeconds))
}
