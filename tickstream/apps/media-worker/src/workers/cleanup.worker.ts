import { readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { env } from '@shared/env'
import { getRedis, keys } from '@shared/redis'

/** Removes scratch directories left behind by an interrupted job. */
export async function cleanupScratch(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  let entries: string[] = []
  try {
    entries = await readdir(env.tmpDir)
  } catch {
    return
  }
  for (const entry of entries) {
    if (!entry.startsWith('media-')) continue
    // Another copy of the worker may be encoding this video right now. Leave its folder alone.
    if (await getRedis().exists(keys.mediaJob(entry.slice('media-'.length)))) continue
    const full = path.join(env.tmpDir, entry)
    const info = await stat(full).catch(() => undefined)
    if (info && Date.now() - info.mtimeMs > maxAgeMs) await rm(full, { recursive: true, force: true })
  }
}
