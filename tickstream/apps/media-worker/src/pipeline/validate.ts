import type { ProbeResult } from './probe'

const MIN_SECONDS = 2
const MAX_SECONDS = 4 * 60 * 60

export function validateProbe(result: ProbeResult): void {
  if (!result.hasVideo) throw new Error('The file has no video track.')
  if (result.durationSeconds < MIN_SECONDS) throw new Error('The video must be at least 2 seconds long.')
  if (result.durationSeconds > MAX_SECONDS) throw new Error('The video must be shorter than 4 hours.')
}
