import { query, queryOne } from '@shared/db'
import type { CreatorSummary, FollowState, VideoSummary } from '@shared/types'
import { HttpError, requireUser, sendJson, type Ctx, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { listVideos } from '../videos/videos.repository'

interface CreatorRow {
  address: string
  username: string
  display_name: string | null
}

async function creatorFromParam(ctx: Ctx): Promise<CreatorRow> {
  const row = await queryOne<CreatorRow>('select address, username, display_name from users where username = $1', [
    (ctx.params.username ?? '').toLowerCase(),
  ])
  if (!row) throw new HttpError(404, 'Creator not found', 'not_found')
  return row
}

async function followState(creator: string, viewer: string | undefined): Promise<FollowState> {
  const [count] = await query<{ followers: number }>('select count(*)::int as followers from follows where creator = $1', [creator])
  const mine = viewer
    ? await queryOne('select 1 from follows where creator = $1 and follower = $2', [creator, viewer])
    : undefined
  return { following: Boolean(mine), followers: count?.followers ?? 0 }
}

/** Following is free. It only controls what shows up in a viewer's feed. */
export function registerSubscriptionRoutes(router: Router): void {
  router.get('/creators/:username/follow', 'optional', async (ctx) => {
    const creator = await creatorFromParam(ctx)
    sendJson(ctx.res, 200, await followState(creator.address, ctx.user))
  })

  router.put('/creators/:username/follow', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    await rateLimit('follow', viewer, 30, 60)
    const creator = await creatorFromParam(ctx)
    if (creator.address === viewer) throw new HttpError(400, 'You cannot follow yourself', 'invalid_request')
    await query('insert into follows (follower, creator) values ($1, $2) on conflict do nothing', [viewer, creator.address])
    sendJson(ctx.res, 200, await followState(creator.address, viewer))
  })

  router.delete('/creators/:username/follow', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const creator = await creatorFromParam(ctx)
    await query('delete from follows where follower = $1 and creator = $2', [viewer, creator.address])
    sendJson(ctx.res, 200, await followState(creator.address, viewer))
  })

  router.get('/me/following', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const rows = await query<CreatorRow & { videos: number; followers: number }>(
      `select u.address, u.username, u.display_name,
         (select count(*)::int from videos v where v.creator = u.address and v.status = 'ready') as videos,
         (select count(*)::int from follows f2 where f2.creator = u.address) as followers
       from follows f join users u on u.address = f.creator
       where f.follower = $1 order by f.created_at desc`,
      [viewer],
    )
    const creators: CreatorSummary[] = rows.map((row) => ({
      address: row.address,
      username: row.username,
      displayName: row.display_name,
      videos: row.videos,
      followers: row.followers,
    }))
    sendJson(ctx.res, 200, { creators })
  })

  router.get('/me/feed', 'required', async (ctx) => {
    const viewer = requireUser(ctx)
    const followed = await query<{ creator: string }>('select creator from follows where follower = $1', [viewer])
    const videos: VideoSummary[] = []
    for (const { creator } of followed.slice(0, 50)) {
      videos.push(...(await listVideos({ creator, status: 'ready', sort: 'new', limit: 6, offset: 0 })))
    }
    videos.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    sendJson(ctx.res, 200, { videos: videos.slice(0, 24) })
  })
}
