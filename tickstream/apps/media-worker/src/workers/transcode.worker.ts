import { SEGMENT_SECONDS } from '@shared/constants'
import { query, queryOne } from '@shared/db'
import { ingest } from '../pipeline/ingest'
import { createEncryption } from '../pipeline/encrypt'
import { readSegments } from '../pipeline/package-hls'
import { probe } from '../pipeline/probe'
import { transcodeToHls } from '../pipeline/transcode'
import { publishSegments, publishThumbnail } from '../pipeline/upload-r2'
import { validateProbe } from '../pipeline/validate'
import { makeThumbnail } from './thumbnail.worker'

interface VideoJobRow {
  id: string
  status: string
  source_key: string | null
}

/** Source file in, encrypted HLS segments and a thumbnail out. Marks the video ready or failed. */
export async function processVideo(videoId: string): Promise<void> {
  const video = await queryOne<VideoJobRow>('select id, status, source_key from videos where id = $1', [videoId])
  if (!video || video.status !== 'processing' || !video.source_key) return
  const workspace = await ingest(video.id, video.source_key)
  try {
    const info = await probe(workspace.input)
    validateProbe(info)
    const encryption = await createEncryption(workspace.dir)
    const playlist = await transcodeToHls(workspace.input, workspace.hlsDir, encryption.keyInfoFile, info)
    const segments = await readSegments(playlist)
    await publishSegments(video.id, workspace.hlsDir, segments)
    const thumbnail = await makeThumbnail(workspace.input, workspace.dir, info.durationSeconds)
    const thumbKey = await publishThumbnail(video.id, thumbnail)
    const duration = segments.reduce((total, segment) => total + segment.duration, 0)
    await query(
      `update videos set status = 'ready', duration_seconds = $2, segments = $3::jsonb, segment_seconds = $4,
         iv = $5, key_hex = $6, thumb_key = $7, error = null, updated_at = now()
       where id = $1`,
      [video.id, duration, JSON.stringify(segments), SEGMENT_SECONDS, encryption.ivHex, encryption.keyHex, thumbKey],
    )
    console.log(`[media] ${video.id} ready (${segments.length} segments)`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed'
    console.error(`[media] ${video.id} failed: ${message}`)
    await query(`update videos set status = 'failed', error = $2, updated_at = now() where id = $1`, [video.id, message.slice(0, 400)])
  } finally {
    await workspace.cleanup()
  }
}
