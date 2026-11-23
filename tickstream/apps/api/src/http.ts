import { env } from '@shared/env'
import type { IncomingMessage, ServerResponse } from 'node:http'

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export interface Ctx {
  req: IncomingMessage
  res: ServerResponse
  url: URL
  params: Record<string, string>
  /** Wallet address of the signed-in user, lower-cased. Set when the route requires or accepts auth. */
  user?: string
  ip: string
}

export type Handler = (ctx: Ctx) => Promise<void> | void

export type AuthMode = 'required' | 'optional' | 'none'

interface Route {
  method: string
  regex: RegExp
  names: string[]
  handler: Handler
  auth: AuthMode
}

export class Router {
  private routes: Route[] = []

  add(method: string, pattern: string, auth: AuthMode, handler: Handler): void {
    const names: string[] = []
    // Escape regex characters in the literal parts of the pattern; only :name segments are captures.
    const source = pattern
      .split(/(:[a-zA-Z]+)/)
      .map((part) => {
        if (part.startsWith(':') && /^:[a-zA-Z]+$/.test(part)) {
          names.push(part.slice(1))
          return '([^/]+)'
        }
        return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      })
      .join('')
    this.routes.push({ method, regex: new RegExp(`^${source}$`), names, handler, auth })
  }

  get(pattern: string, auth: AuthMode, handler: Handler): void {
    this.add('GET', pattern, auth, handler)
  }
  post(pattern: string, auth: AuthMode, handler: Handler): void {
    this.add('POST', pattern, auth, handler)
  }
  put(pattern: string, auth: AuthMode, handler: Handler): void {
    this.add('PUT', pattern, auth, handler)
  }
  patch(pattern: string, auth: AuthMode, handler: Handler): void {
    this.add('PATCH', pattern, auth, handler)
  }
  delete(pattern: string, auth: AuthMode, handler: Handler): void {
    this.add('DELETE', pattern, auth, handler)
  }

  match(method: string, pathname: string): { route: Route; params: Record<string, string> } | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue
      const found = route.regex.exec(pathname)
      if (!found) continue
      const params: Record<string, string> = {}
      try {
        route.names.forEach((name, index) => {
          params[name] = decodeURIComponent(found[index + 1] ?? '')
        })
      } catch {
        throw new HttpError(400, 'Malformed address', 'invalid_request')
      }
      return { route, params }
    }
    return undefined
  }
}

export function sendJson(res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(body)
}

export async function readJson<T = Record<string, unknown>>(req: IncomingMessage, limitBytes = 64 * 1024): Promise<T> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk as Uint8Array)
    size += buffer.length
    if (size > limitBytes) throw new HttpError(413, 'Request body too large')
    chunks.push(buffer)
  }
  if (size === 0) return {} as T
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as T
  } catch {
    throw new HttpError(400, 'Body must be valid JSON')
  }
}

export function requireUser(ctx: Ctx): string {
  if (!ctx.user) throw new HttpError(401, 'Sign in with your wallet first', 'unauthorized')
  return ctx.user
}

/**
 * The caller's address, used only for rate limits. Forwarded headers are client-controlled unless a trusted proxy
 * sits in front, so they are read only when TRUST_PROXY is set, and then only the last entry (the one the proxy added).
 */
export function clientIp(req: IncomingMessage): string {
  if (env.trustProxy) {
    const forwarded = req.headers['x-forwarded-for']
    const raw = Array.isArray(forwarded) ? forwarded.join(',') : forwarded
    const parts = raw?.split(',') ?? []
    const last = parts[parts.length - 1]?.trim()
    if (last) return last
  }
  return req.socket.remoteAddress ?? 'unknown'
}
