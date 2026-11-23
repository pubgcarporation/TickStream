import type { ServerResponse } from 'node:http'
import { HttpError, sendJson } from '../http'

export function handleError(res: ServerResponse, error: unknown): void {
  if (res.headersSent) {
    res.end()
    return
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.message, code: error.code, ...error.extra })
    return
  }
  console.error('[api] unhandled error', error)
  sendJson(res, 500, { error: 'Something went wrong on our side.', code: 'internal' })
}
