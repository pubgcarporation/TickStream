import { getRedis, keys } from '@shared/redis'
import { HttpError } from '../http'

/** Fixed-window counter in Redis. Throws 429 once `max` calls land inside `windowSeconds`. */
export async function rateLimit(bucket: string, id: string, max: number, windowSeconds: number): Promise<void> {
  const redis = getRedis()
  const key = keys.rate(bucket, id)
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  if (count > max) {
    const ttl = await redis.ttl(key)
    throw new HttpError(429, 'Too many requests. Slow down and try again shortly.', 'rate_limited', {
      retryAfterSeconds: Math.max(ttl, 1),
    })
  }
}
