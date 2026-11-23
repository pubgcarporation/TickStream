import { query, queryOne } from '@shared/db'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { optionalStr } from '../../middleware/request-validation'
import { listVideos } from '../videos/videos.repository'
import { mapUser, type UserRow } from './users.mapper'

const USERNAME = /^[a-z0-9_]{3,24}$/

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

  router.get('/users/:username', 'none', async (ctx) => {
    const row = await queryOne<UserRow>('select * from users where username = $1', [ctx.params.username?.toLowerCase()])
    if (!row) throw new HttpError(404, 'Creator not found', 'not_found')
    const videos = await listVideos({ creator: row.address, status: 'ready', sort: 'new', limit: 48, offset: 0 })
    sendJson(ctx.res, 200, { user: mapUser(row), videos })
  })
}
