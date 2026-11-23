import { createHash, randomBytes } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { AUTH_TOKEN_TTL_SECONDS } from '@shared/constants'
import { getRedis, keys } from '@shared/redis'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function bearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  const token = header.slice('Bearer '.length).trim()
  return token.length === 64 ? token : undefined
}

/** Resolves a Bearer token to the wallet address it was issued to, or undefined. */
export async function authenticate(req: IncomingMessage): Promise<string | undefined> {
  const token = bearerToken(req)
  if (!token) return undefined
  return (await getRedis().get(keys.authToken(hashToken(token)))) ?? undefined
}

export async function issueToken(address: string): Promise<string> {
  const token = randomBytes(32).toString('hex')
  await getRedis().set(keys.authToken(hashToken(token)), address.toLowerCase(), 'EX', AUTH_TOKEN_TTL_SECONDS)
  return token
}

export async function revokeToken(token: string): Promise<void> {
  await getRedis().del(keys.authToken(hashToken(token)))
}
