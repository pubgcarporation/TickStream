import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@shared/env'
import { getStorage } from '@shared/storage'

export interface Workspace {
  dir: string
  input: string
  hlsDir: string
  cleanup: () => Promise<void>
}

/** Pulls the private source file into a scratch directory for processing. */
export async function ingest(videoId: string, sourceKey: string): Promise<Workspace> {
  const dir = path.join(env.tmpDir, `media-${videoId}`)
  await rm(dir, { recursive: true, force: true })
  const hlsDir = path.join(dir, 'hls')
  await mkdir(hlsDir, { recursive: true })
  const input = path.join(dir, 'source')
  await getStorage().downloadTo(sourceKey, input)
  return { dir, input, hlsDir, cleanup: () => rm(dir, { recursive: true, force: true }) }
}
