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

/**
 * Seconds of video a payment for segments [from, from + count) covers. Every segment is SEGMENT_SECONDS long except
 * the last, which holds whatever is left of the video, so the last payment is never more than what exists.
 */
export function chunkSecondsFor(from: number, count: number, segCount: number, durationSeconds: number): number {
  const end = Math.min(from + count, segCount)
  const nominal = (end - from) * SEGMENT_SECONDS
  if (end < segCount) return nominal
  const remaining = durationSeconds - from * SEGMENT_SECONDS
  return Math.max(0.001, Math.min(nominal, remaining))
}

/** Amount owed for `seconds` of video at `priceMicro` per second, in whole USDC base units (at least 1). */
export function secondsAmount(priceMicro: number, seconds: number): number {
  return Math.max(1, Math.round(priceMicro * seconds))
}
