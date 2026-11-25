import { SEGMENT_SECONDS } from './constants'

/**
 * All amounts are integers in USDC base units (the ERC-20 view, 6 decimals). One payment unlocks exactly one segment.
 * A video's segment length comes from the video itself. Videos not yet re-encoded may still have 1-second segments.
 */

/** Amount owed for `segments` whole segments of `segSeconds` each at `priceMicro` per second. */
export function segmentsAmount(priceMicro: number, segments: number, segSeconds: number = SEGMENT_SECONDS): number {
  return priceMicro * segments * segSeconds
}

export function segmentCountFor(durationSeconds: number, segSeconds: number = SEGMENT_SECONDS): number {
  return Math.max(1, Math.ceil(durationSeconds / segSeconds))
}

/**
 * Seconds of video a payment for segments [from, from + count) covers. Every segment is `segSeconds` long except
 * the last, which holds whatever is left of the video, so the last payment is never more than what exists.
 */
export function chunkSecondsFor(from: number, count: number, segCount: number, durationSeconds: number, segSeconds: number): number {
  const end = Math.min(from + count, segCount)
  const nominal = (end - from) * segSeconds
  if (end < segCount) return nominal
  const remaining = durationSeconds - from * segSeconds
  return Math.max(0.001, Math.min(nominal, remaining))
}

/** Amount owed for `seconds` of video at `priceMicro` per second, in whole USDC base units (at least 1). */
export function secondsAmount(priceMicro: number, seconds: number): number {
  return Math.max(1, Math.round(priceMicro * seconds))
}
