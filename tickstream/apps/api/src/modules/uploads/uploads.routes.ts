import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { query } from '@shared/db'
import { env } from '@shared/env'
import { getRedis, keys } from '@shared/redis'
import { getStorage, storageKeys } from '@shared/storage'
import { HttpError, requireUser, sendJson, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { uuid } from '../../middleware/request-validation'
import { getVideoRow } from '../videos/videos.repository'

class SizeLimit extends Transform {
  private seen = 0
  constructor(private readonly limit: number) {
    super()
  }
  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null, data?: Buffer) => void) {
    this.seen += chunk.length
    if (this.seen > this.limit) callback(new HttpError(413, 'That file is larger than the upload limit', 'too_large'))
    else callback(null, chunk)
  }
}

export function registerUploadRoutes(router: Router): void {
  // The raw video file is the request body. It is stored privately and queued for the media worker.
  router.put('/videos/:id/source', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    await rateLimit('upload', addr, 10, 600)
    const row = await getVideoRow(uuid(ctx.params.id ?? ''))
    if (!row || row.status === 'removed') throw new HttpError(404, 'Video not found', 'not_found')
    if (row.creator !== addr) throw new HttpError(403, 'Only the creator can upload', 'forbidden')
    if (row.status !== 'uploading' && row.status !== 'failed') {
      throw new HttpError(409, 'This video already has a source file', 'already_uploaded')
    }
    const contentType = String(ctx.req.headers['content-type'] ?? '')
    if (!contentType.startsWith('video/')) throw new HttpError(415, 'Upload a video file', 'unsupported_type')
    const declared = Number(ctx.req.headers['content-length'] ?? 0)
    if (declared > env.maxUploadBytes) throw new HttpError(413, 'That file is larger than the upload limit', 'too_large')

    await mkdir(env.tmpDir, { recursive: true })
    const tmp = path.join(env.tmpDir, `${row.id}.upload`)
    try {
      await pipeline(ctx.req, new SizeLimit(env.maxUploadBytes), createWriteStream(tmp))
      const sourceKey = storageKeys.source(row.id)
      await getStorage().putFile(sourceKey, tmp, contentType)
      await query(
        `update videos set status = 'processing', source_key = $2, error = null, updated_at = now() where id = $1`,
        [row.id, sourceKey],
      )
      await getRedis().lpush(keys.mediaQueue, JSON.stringify({ videoId: row.id }))
      sendJson(ctx.res, 200, { status: 'processing' })
    } finally {
      await rm(tmp, { force: true })
    }
  })
}
