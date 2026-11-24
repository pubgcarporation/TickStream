import { COMMENT_MAX_LENGTH } from '@shared/constants'
import { query, queryOne } from '@shared/db'
import type { CommentItem } from '@shared/types'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { isAdmin } from '../../middleware/authorization'
import { rateLimit } from '../../middleware/rate-limit'
import { str, uuid } from '../../middleware/request-validation'

interface CommentRow {
  id: string
  body: string
  created_at: Date
  cursor: string
  author: string
  username: string
  display_name: string | null
  avatar_updated_at: Date | null
  video_creator: string
}

const SELECT = `
  select c.id, c.body, c.created_at, to_char(c.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor, c.author, u.username, u.display_name, u.avatar_updated_at, v.creator as video_creator
  from comments c
  join users u on u.address = c.author
  join videos v on v.id = c.video_id`

function mapComment(row: CommentRow, viewer: string | undefined): CommentItem {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at.toISOString(),
    author: {
      address: row.author,
      username: row.username,
      displayName: row.display_name,
      avatarVersion: row.avatar_updated_at ? Math.floor(row.avatar_updated_at.getTime() / 1000) : null,
    },
    canRemove: Boolean(viewer) && (viewer === row.author || viewer === row.video_creator || isAdmin(viewer)),
  }
}

export function registerCommentRoutes(router: Router): void {
  router.get('/videos/:id/comments', 'optional', async (ctx) => {
    const videoId = uuid(ctx.params.id ?? '')
    const video = await queryOne<{ status: string }>('select status from videos where id = $1', [videoId])
    if (!video || video.status === 'removed') throw new HttpError(404, 'Video not found', 'not_found')
    const before = ctx.url.searchParams.get('before')
    const parsedBefore = before && !Number.isNaN(Date.parse(before)) ? before : null
    const rows = await query<CommentRow>(
      `${SELECT}
       where c.video_id = $1 and not c.removed and ($2::timestamptz is null or c.created_at < $2::timestamptz)
       order by c.created_at desc limit 31`,
      [videoId, parsedBefore],
    )
    const page = rows.slice(0, 30)
    sendJson(ctx.res, 200, {
      comments: page.map((row) => mapComment(row, ctx.user)),
      nextBefore: rows.length > 30 ? (page[page.length - 1]?.cursor ?? null) : null,
    })
  })

  router.post('/videos/:id/comments', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('comment', viewer, 8, 60)
    const videoId = uuid(ctx.params.id ?? '')
    const body = await readJson(ctx.req, 8 * 1024)
    const text = str(body.body, 'comment', 1, COMMENT_MAX_LENGTH)
    const video = await queryOne<{ status: string }>('select status from videos where id = $1', [videoId])
    if (!video || video.status === 'removed') throw new HttpError(404, 'Video not found', 'not_found')
    const inserted = await query<{ id: string }>(
      'insert into comments (video_id, author, body) values ($1, $2, $3) returning id',
      [videoId, viewer, text],
    )
    const row = await queryOne<CommentRow>(`${SELECT} where c.id = $1`, [inserted[0]?.id])
    if (!row) throw new HttpError(500, 'Could not save your comment')
    sendJson(ctx.res, 201, { comment: mapComment(row, viewer) })
  })

  router.delete('/comments/:id', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const row = await queryOne<CommentRow>(`${SELECT} where c.id = $1 and not c.removed`, [uuid(ctx.params.id ?? '')])
    if (!row) throw new HttpError(404, 'Comment not found', 'not_found')
    if (!mapComment(row, viewer).canRemove) throw new HttpError(403, 'You cannot remove this comment', 'forbidden')
    await query('update comments set removed = true where id = $1', [row.id])
    sendJson(ctx.res, 200, { ok: true })
  })
}
