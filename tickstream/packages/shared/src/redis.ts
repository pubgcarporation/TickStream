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
  rate: (bucket: string, id: string) => `rate:${bucket}:${id}`,
} as const
