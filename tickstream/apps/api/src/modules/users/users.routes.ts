import { pipeline } from 'node:stream/promises'
import type { IncomingMessage } from 'node:http'
import { query, queryOne } from '@shared/db'
import { getStorage, storageKeys } from '@shared/storage'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { optionalStr } from '../../middleware/request-validation'
import { listVideos } from '../videos/videos.repository'
import { mapUser, type UserRow } from './users.mapper'

const USERNAME = /^[a-z0-9_]{3,24}$/
const MAX_AVATAR_BYTES = 512 * 1024

/** The image type by its first bytes. The Content-Type header is never trusted, and anything else is refused. */
export function imageType(data: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (data.length > 12 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length > 12 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (data.length > 12 && data.subarray(0, 4).toString('latin1') === 'RIFF' && data.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > limit) throw new HttpError(413, 'That picture is too large. Use one under 512 KB.', 'too_large')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

export function registerUserRoutes(router: Router): void {
  router.patch('/users/me', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const body = await readJson(ctx.req)
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : undefined
    if (username !== undefined && !USERNAME.test(username)) {
      throw new HttpError(400, 'Username must be 3 to 24 characters: letters, numbers or underscores', 'invalid_request')
    }
    const displayName = optionalStr(body.displayName, 'displayName', 60)
    const bio = optionalStr(body.bio, 'bio', 280)
    try {
      const rows = await query<UserRow>(
        `update users set
           username = coalesce($2, username),
           display_name = case when $3::boolean then $4 else display_name end,
           bio = case when $5::boolean then $6 else bio end
         where address = $1 returning *`,
        [addr, username ?? null, body.displayName !== undefined, displayName ?? null, body.bio !== undefined, bio ?? null],
      )
      const row = rows[0]
      if (!row) throw new HttpError(404, 'Profile not found', 'not_found')
      sendJson(ctx.res, 200, { user: mapUser(row) })
    } catch (error) {
      if (error instanceof HttpError) throw error
      if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
        throw new HttpError(409, 'That username is taken', 'username_taken')
      }
      throw error
    }
  })

  // The picture is the request body. It is checked by its bytes and stored under the owner's address.
  router.put('/users/me/avatar', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    await rateLimit('avatar', addr, 10, 600)
    const data = await readBody(ctx.req, MAX_AVATAR_BYTES)
    const type = imageType(data)
    if (!type) throw new HttpError(415, 'Use a JPEG, PNG or WebP picture', 'unsupported_type')
    const key = storageKeys.avatar(addr, type === 'image/jpeg' ? 'jpg' : type === 'image/png' ? 'png' : 'webp')
    const previous = await queryOne<{ avatar_key: string | null }>('select avatar_key from users where address = $1', [addr])
    await getStorage().putBuffer(key, data, type)
    const row = await queryOne<UserRow>('update users set avatar_key = $2, avatar_updated_at = now() where address = $1 returning *', [addr, key])
    if (!row) throw new HttpError(404, 'Profile not found', 'not_found')
    if (previous?.avatar_key && previous.avatar_key !== key) await getStorage().remove(previous.avatar_key).catch(() => undefined)
    sendJson(ctx.res, 200, { user: mapUser(row) })
  })

  router.delete('/users/me/avatar', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const previous = await queryOne<{ avatar_key: string | null }>('select avatar_key from users where address = $1', [addr])
    const row = await queryOne<UserRow>('update users set avatar_key = null, avatar_updated_at = null where address = $1 returning *', [addr])
    if (!row) throw new HttpError(404, 'Profile not found', 'not_found')
    if (previous?.avatar_key) await getStorage().remove(previous.avatar_key).catch(() => undefined)
    sendJson(ctx.res, 200, { user: mapUser(row) })
  })

  router.get('/users/:username/avatar', 'none', async (ctx) => {
    const row = await queryOne<{ avatar_key: string | null }>('select avatar_key from users where username = $1', [ctx.params.username?.toLowerCase()])
    if (!row?.avatar_key) throw new HttpError(404, 'No picture', 'not_found')
    const object = await getStorage().getObject(row.avatar_key)
    // The page asks with ?v=<version>, so a changed picture is a new address and can be cached for a long time.
    const versioned = ctx.url.searchParams.has('v')
    ctx.res.writeHead(200, {
      'Content-Type': object.contentType,
      'Content-Length': object.size,
      'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
      'Cross-Origin-Resource-Policy': 'cross-site',
    })
    await pipeline(object.stream, ctx.res).catch(() => undefined)
  })

  router.get('/users/:username', 'none', async (ctx) => {
    const row = await queryOne<UserRow>('select * from users where username = $1', [ctx.params.username?.toLowerCase()])
    if (!row) throw new HttpError(404, 'Creator not found', 'not_found')
    const videos = await listVideos({ creator: row.address, status: 'ready', sort: 'new', limit: 48, offset: 0 })
    sendJson(ctx.res, 200, { user: mapUser(row), videos })
  })
}
