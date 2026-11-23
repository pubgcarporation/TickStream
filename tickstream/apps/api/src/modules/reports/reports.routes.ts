import { REPORT_REASONS } from '@shared/constants'
import { query, queryOne } from '@shared/db'
import { HttpError, readJson, requireUser, sendJson, type Ctx, type Router } from '../../http'
import { rateLimit } from '../../middleware/rate-limit'
import { optionalStr, uuid } from '../../middleware/request-validation'

const REASONS: string[] = REPORT_REASONS.map((reason) => reason.value)

async function parse(ctx: Ctx): Promise<{ reporter: string; reason: string; details: string }> {
  const reporter = requireUser(ctx)
  await rateLimit('report', reporter, 10, 3600)
  const body = await readJson(ctx.req, 8 * 1024)
  if (typeof body.reason !== 'string' || !REASONS.includes(body.reason)) {
    throw new HttpError(400, 'Pick a reason for the report', 'invalid_request')
  }
  return { reporter, reason: body.reason, details: optionalStr(body.details, 'details', 500) ?? '' }
}

export function registerReportRoutes(router: Router): void {
  router.post('/videos/:id/report', 'required', async (ctx) => {
    const { reporter, reason, details } = await parse(ctx)
    const videoId = uuid(ctx.params.id ?? '')
    const video = await queryOne('select 1 from videos where id = $1 and status <> $2', [videoId, 'removed'])
    if (!video) throw new HttpError(404, 'Video not found', 'not_found')
    await query(
      `insert into reports (video_id, reporter, reason, details) values ($1, $2, $3, $4) on conflict do nothing`,
      [videoId, reporter, reason, details],
    )
    sendJson(ctx.res, 201, { ok: true })
  })

  router.post('/comments/:id/report', 'required', async (ctx) => {
    const { reporter, reason, details } = await parse(ctx)
    const commentId = uuid(ctx.params.id ?? '')
    const comment = await queryOne('select 1 from comments where id = $1 and not removed', [commentId])
    if (!comment) throw new HttpError(404, 'Comment not found', 'not_found')
    await query(
      `insert into reports (comment_id, reporter, reason, details) values ($1, $2, $3, $4) on conflict do nothing`,
      [commentId, reporter, reason, details],
    )
    sendJson(ctx.res, 201, { ok: true })
  })
}
