import { randomUUID } from 'node:crypto'
import { Redis } from 'ioredis'
import { env } from './env'

let client: Redis | undefined

export function getRedis(): Redis {
  client ??= new Redis(env.redisUrl(), { maxRetriesPerRequest: 3 })
  return client
}

/** A dedicated connection for blocking commands such as BRPOP. */
export function createBlockingRedis(): Redis {
  return new Redis(env.redisUrl(), { maxRetriesPerRequest: null })
}

export const keys = {
  authToken: (hash: string) => `auth:token:${hash}`,
  authNonce: (address: string) => `auth:nonce:${address.toLowerCase()}`,
  session: (id: string) => `play:session:${id}`,
  viewerActive: (address: string) => `play:viewer:${address.toLowerCase()}`,
  grantLock: (id: string) => `play:lock:${id}`,
  paymentNonce: (nonce: string) => `pay:nonce:${nonce.toLowerCase()}`,
  mediaQueue: 'jobs:media',
  mediaJob: (videoId: string) => `jobs:media:running:${videoId}`,
  reconcileClaim: (paymentId: string) => `settle:claim:${paymentId}`,
  lock: (name: string) => `lock:${name}`,
  rate: (bucket: string, id: string) => `rate:${bucket}:${id}`,
} as const

export interface Lock {
  /** Extends the lock if this holder still owns it. Returns false when it was lost. */
  renew: () => Promise<boolean>
  release: () => Promise<void>
}

const RENEW = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end`
const RELEASE = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`

/**
 * A lock shared by every copy of a service. Returns undefined when someone else holds it. It expires on its own after
 * `ttlMs`, so a crashed holder never blocks the others for long; long jobs call `renew` while they run.
 */
export async function acquireLock(key: string, ttlMs: number): Promise<Lock | undefined> {
  const redis = getRedis()
  const token = randomUUID()
  const got = await redis.set(key, token, 'PX', ttlMs, 'NX')
  if (got !== 'OK') return undefined
  return {
    renew: async () => Number(await redis.eval(RENEW, 1, key, token, String(ttlMs))) === 1,
    release: async () => {
      await redis.eval(RELEASE, 1, key, token)
    },
  }
}

/** Like `acquireLock`, but keeps trying for up to `waitMs`. Returns undefined if the lock never frees up. */
export async function acquireLockWait(key: string, ttlMs: number, waitMs: number): Promise<Lock | undefined> {
  const deadline = Date.now() + waitMs
  for (;;) {
    const lock = await acquireLock(key, ttlMs)
    if (lock) return lock
    if (Date.now() >= deadline) return undefined
    await new Promise((resolve) => setTimeout(resolve, 60))
  }
}
