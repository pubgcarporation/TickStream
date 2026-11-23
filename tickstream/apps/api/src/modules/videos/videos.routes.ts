import { CATEGORY_SLUGS, MAX_PRICE_PER_SECOND, MIN_PRICE_PER_SECOND } from '@shared/constants'
import { query } from '@shared/db'
import { getStorage } from '@shared/storage'
import { HttpError, readJson, requireUser, sendJson, type Ctx, type Router } from '../../http'
import { int, optionalStr, str, uuid } from '../../middleware/request-validation'
import { getVideoRow, listVideos, mapVideo, type VideoRow } from './videos.repository'

function category(value: unknown): string {
  if (value === undefined || value === '') return 'other'
  if (typeof value !== 'string' || !CATEGORY_SLUGS.includes(value)) {
    throw new HttpError(400, 'Pick one of the listed categories', 'invalid_request')
  }
  return value
}

async function ownedVideo(ctx: Ctx): Promise<VideoRow> {
  const addr = requireUser(ctx)
  const row = await getVideoRow(uuid(ctx.params.id ?? ''))
  if (!row || row.status === 'removed') throw new HttpError(404, 'Video not found', 'not_found')
  if (row.creator !== addr) throw new HttpError(403, 'Only the creator can change this video', 'forbidden')
  return row
}

export function registerVideoRoutes(router: Router): void {
  router.get('/videos', 'none', async (ctx) => {
    const q = ctx.url.searchParams
    const sortParam = q.get('sort')
    const sort = sortParam === 'trending' || sortParam === 'price' ? sortParam : 'new'
    const limit = Math.min(Math.max(Number(q.get('limit') ?? 24) || 24, 1), 48)
    const offset = Math.max(Number(q.get('offset') ?? 0) || 0, 0)
    const cat = q.get('category') ?? undefined
    const search = q.get('q')?.trim().slice(0, 80) || undefined
    const videos = await listVideos({
      status: 'ready',
      sort,
      category: cat && CATEGORY_SLUGS.includes(cat) ? cat : undefined,
      q: search,
      limit,
      offset,
    })
    sendJson(ctx.res, 200, { videos })
  })

  router.get('/me/videos', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const videos = await listVideos({ creator: addr, sort: 'new', limit: 100, offset: 0 })
    sendJson(ctx.res, 200, { videos })
  })

  router.get('/videos/:id', 'optional', async (ctx) => {
    const row = await getVideoRow(uuid(ctx.params.id ?? ''))
    if (!row || row.status === 'removed') throw new HttpError(404, 'Video not found', 'not_found')
    if (row.status !== 'ready' && row.creator !== ctx.user) throw new HttpError(404, 'Video not found', 'not_found')
    sendJson(ctx.res, 200, { video: mapVideo(row), error: row.creator === ctx.user ? row.error : null })
  })

  router.get('/videos/:id/thumbnail', 'none', async (ctx) => {
    const row = await getVideoRow(uuid(ctx.params.id ?? ''))
    if (!row?.thumb_key || row.status !== 'ready') throw new HttpError(404, 'No thumbnail', 'not_found')
    const object = await getStorage().getObject(row.thumb_key)
    ctx.res.writeHead(200, {
      'Content-Type': object.contentType,
      'Content-Length': object.size,
      'Cache-Control': 'public, max-age=3600',
    })
    object.stream.pipe(ctx.res)
  })

  router.post('/videos', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const body = await readJson(ctx.req)
    const title = str(body.title, 'title', 2, 120)
    const description = optionalStr(body.description, 'description', 2000) ?? ''
    const priceMicro = int(body.priceMicro, 'priceMicro', MIN_PRICE_PER_SECOND, MAX_PRICE_PER_SECOND)
    const rows = await query<{ id: string }>(
      `insert into videos (creator, title, description, category, price_micro)
       values ($1, $2, $3, $4, $5) returning id`,
      [addr, title, description, category(body.category), priceMicro],
    )
    sendJson(ctx.res, 201, { id: rows[0]?.id })
  })

  router.patch('/videos/:id', 'required', async (ctx) => {
    const row = await ownedVideo(ctx)
    const body = await readJson(ctx.req)
    const title = body.title !== undefined ? str(body.title, 'title', 2, 120) : row.title
    const description = body.description !== undefined ? (optionalStr(body.description, 'description', 2000) ?? '') : row.description
    const cat = body.category !== undefined ? category(body.category) : row.category
    const price = body.priceMicro !== undefined ? int(body.priceMicro, 'priceMicro', MIN_PRICE_PER_SECOND, MAX_PRICE_PER_SECOND) : row.price_micro
    await query(
      `update videos set title = $2, description = $3, category = $4, price_micro = $5, updated_at = now() where id = $1`,
      [row.id, title, description, cat, price],
    )
    const updated = await getVideoRow(row.id)
    sendJson(ctx.res, 200, { video: updated ? mapVideo(updated) : null })
  })

  router.delete('/videos/:id', 'required', async (ctx) => {
    const row = await ownedVideo(ctx)
    await query(`update videos set status = 'removed', updated_at = now() where id = $1`, [row.id])
    sendJson(ctx.res, 200, { ok: true })
  })
}
