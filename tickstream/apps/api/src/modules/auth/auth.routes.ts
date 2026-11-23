import { randomBytes } from 'node:crypto'
import { getAddress, verifyMessage } from 'viem'
import { AUTH_NONCE_TTL_SECONDS } from '@shared/constants'
import { query, queryOne } from '@shared/db'
import { getRedis, keys } from '@shared/redis'
import { HttpError, readJson, requireUser, sendJson, type Router } from '../../http'
import { bearerToken, issueToken, revokeToken } from '../../middleware/authentication'
import { rateLimit } from '../../middleware/rate-limit'
import { address, str } from '../../middleware/request-validation'
import { mapUser, type UserRow } from '../users/users.mapper'

function signInMessage(addr: string, nonce: string, issuedAt: string): string {
  return [
    'TickStream wants you to sign in with your wallet.',
    '',
    'This signature proves you own the address. It does not cost anything or move funds.',
    '',
    `Address: ${addr}`,
    `Nonce: ${nonce}`,
    `Issued: ${issuedAt}`,
  ].join('\n')
}

async function ensureUser(addr: string): Promise<UserRow> {
  const existing = await queryOne<UserRow>('select * from users where address = $1', [addr])
  if (existing) return existing
  const hex = addr.slice(2)
  for (const length of [6, 10, 14]) {
    const username = `user_${hex.slice(-length)}`
    const rows = await query<UserRow>(
      'insert into users (address, username) values ($1, $2) on conflict do nothing returning *',
      [addr, username],
    )
    if (rows[0]) return rows[0]
    const raced = await queryOne<UserRow>('select * from users where address = $1', [addr])
    if (raced) return raced
  }
  throw new HttpError(500, 'Could not create your profile')
}

export function registerAuthRoutes(router: Router): void {
  router.post('/auth/nonce', 'none', async (ctx) => {
    await rateLimit('auth-nonce', ctx.ip, 30, 60)
    const body = await readJson(ctx.req)
    const addr = address(body.address, 'address')
    const nonce = randomBytes(16).toString('hex')
    const message = signInMessage(getAddress(addr), nonce, new Date().toISOString())
    await getRedis().set(keys.authNonce(addr), message, 'EX', AUTH_NONCE_TTL_SECONDS)
    sendJson(ctx.res, 200, { message })
  })

  router.post('/auth/verify', 'none', async (ctx) => {
    await rateLimit('auth-verify', ctx.ip, 20, 60)
    const body = await readJson(ctx.req)
    const addr = address(body.address, 'address')
    const signature = str(body.signature, 'signature', 130, 2000)
    const redis = getRedis()
    const message = await redis.get(keys.authNonce(addr))
    if (!message) throw new HttpError(400, 'Sign-in request expired. Try again.', 'nonce_expired')
    let valid = false
    try {
      valid = await verifyMessage({ address: getAddress(addr), message, signature: signature as `0x${string}` })
    } catch {
      valid = false
    }
    if (!valid) throw new HttpError(401, 'That signature does not match this wallet.', 'bad_signature')
    await redis.del(keys.authNonce(addr))
    const user = await ensureUser(addr)
    const token = await issueToken(addr)
    sendJson(ctx.res, 200, { token, user: mapUser(user) })
  })

  router.get('/auth/me', 'required', async (ctx) => {
    const addr = requireUser(ctx)
    const user = await ensureUser(addr)
    sendJson(ctx.res, 200, { user: mapUser(user) })
  })

  router.post('/auth/logout', 'required', async (ctx) => {
    const token = bearerToken(ctx.req)
    if (token) await revokeToken(token)
    sendJson(ctx.res, 200, { ok: true })
  })
}
