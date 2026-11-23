import path from 'node:path'
import { ffmpegPath, run } from '../config/binaries'

/** Grabs one frame near the start of the video as a small JPEG preview. */
export async function makeThumbnail(input: string, dir: string, durationSeconds: number): Promise<string> {
  const output = path.join(dir, 'thumbnail.jpg')
  const at = Math.min(1, durationSeconds / 2)
  await run(ffmpegPath, ['-y', '-ss', at.toFixed(2), '-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', output])
  return output
}
