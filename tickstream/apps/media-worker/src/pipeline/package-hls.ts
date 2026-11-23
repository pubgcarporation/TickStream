import { readFile } from 'node:fs/promises'
import type { SegmentInfo } from '@shared/types'

/** Reads the segment list (file name and duration) from the playlist ffmpeg wrote. */
export async function readSegments(playlistFile: string): Promise<SegmentInfo[]> {
  const lines = (await readFile(playlistFile, 'utf8')).split('\n').map((line) => line.trim())
  const segments: SegmentInfo[] = []
  let pending: number | undefined
  for (const line of lines) {
    if (line.startsWith('#EXTINF:')) {
      pending = Number(line.slice('#EXTINF:'.length).split(',')[0])
    } else if (line && !line.startsWith('#') && pending !== undefined) {
      segments.push({ name: line, duration: pending })
      pending = undefined
    }
  }
  if (segments.length === 0) throw new Error('The encoder produced no segments.')
  return segments
}
