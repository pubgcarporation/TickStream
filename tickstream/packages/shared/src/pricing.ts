import { SEGMENT_SECONDS } from './constants'

/** All amounts are integers in USDC base units (the ERC-20 view, 6 decimals). */
export function chunkSegments(chunkSeconds: number): number {
  return Math.max(1, Math.round(chunkSeconds / SEGMENT_SECONDS))
}

/** Amount owed for `segments` whole segments at `priceMicro` per second. */
export function segmentsAmount(priceMicro: number, segments: number): number {
  return priceMicro * segments * SEGMENT_SECONDS
}

export function segmentCountFor(durationSeconds: number): number {
  return Math.max(1, Math.ceil(durationSeconds / SEGMENT_SECONDS))
}
