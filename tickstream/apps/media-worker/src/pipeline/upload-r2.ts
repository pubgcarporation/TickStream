import path from 'node:path'
import { getStorage, storageKeys } from '@shared/storage'
import type { SegmentInfo } from '@shared/types'

/** Stores the encrypted segments in the private bucket (Cloudflare R2 or the local driver). */
export async function publishSegments(videoId: string, hlsDir: string, segments: SegmentInfo[]): Promise<void> {
  const storage = getStorage()
  for (const segment of segments) {
    await storage.putFile(storageKeys.segment(videoId, segment.name), path.join(hlsDir, segment.name), 'video/mp2t')
  }
}

export async function publishThumbnail(videoId: string, file: string): Promise<string> {
  const key = storageKeys.thumbnail(videoId)
  await getStorage().putFile(key, file, 'image/jpeg')
  return key
}
