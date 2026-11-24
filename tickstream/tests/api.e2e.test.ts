/**
 * End-to-end checks of the API: payments, billing, sessions, comments and the feed.
 * Runs the real API against a throwaway Postgres database and Redis, with a stand-in for Circle Gateway.
 *
 *   TEST_DATABASE_URL=postgres://postgres:pw@127.0.0.1:5432/tickstream_test \
 *   TEST_REDIS_URL=redis://127.0.0.1:6379/15 bun run test:api
 *
 * The database is wiped and Redis database 15 is flushed, so never point these at real data.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { BatchEvmScheme } from '@circle-fin/x402-batching/client'
import { Pool } from 'pg'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

const DB = process.env.TEST_DATABASE_URL
const REDIS = process.env.TEST_REDIS_URL
const run = DB && REDIS ? describe : describe.skip

const API_PORT = 3911
const GATEWAY_PORT = 58911
const API = `http://127.0.0.1:${API_PORT}`

let gatewayDelayMs = 0
const settled: Array<{ to: string; value: string }> = []

run('TickStream API', () => {
  let api: ReturnType<typeof Bun.spawn>
  let gateway: ReturnType<typeof Bun.serve>
  let pool: Pool
  const viewer = privateKeyToAccount(generatePrivateKey())
  const creator = privateKeyToAccount(generatePrivateKey())
  const scheme = new BatchEvmScheme(viewer as never)
  let token = ''
  // The web client code reads the API address and token store when it loads, so set them first.
  let client: typeof import('@/lib/api')
  let payments: typeof import('@/components/player/payments')

  const headers = () => ({ 'content-type': 'application/json', authorization: `Bearer ${token}` })

  async function createVideo(durationSeconds: number, priceMicro: number): Promise<string> {
    const count = Math.ceil(durationSeconds / 2)
    const segments = Array.from({ length: count }, (_, i) => ({ name: `seg_${i}.ts`, duration: i === count - 1 ? durationSeconds - 2 * (count - 1) : 2 }))
    const result = await pool.query(
      `insert into videos (creator, title, price_micro, status, duration_seconds, segment_seconds, segments, iv, key_hex, preview_seconds)
       values ($1, 'test', $2, 'ready', $3, 2, $4, '00112233445566778899aabbccddeeff', '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff', 0) returning id`,
      [creator.address.toLowerCase(), priceMicro, durationSeconds, JSON.stringify(segments)],
    )
    return result.rows[0].id as string
  }

  async function startSession(videoId: string, chunkSeconds: number, capMicro = 10_000_000) {
    const created = await client.api<{ session: { id: string } }>(`videos/${videoId}/sessions`, {
      method: 'POST',
      body: { payer: viewer.address, capMicro, chunkSeconds, startSecond: 0 },
    })
    return created.session.id
  }

  beforeAll(async () => {
    const store = new Map<string, string>()
    Object.assign(globalThis, {
      localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
    })
    process.env.VITE_API_URL = API
    pool = new Pool({ connectionString: DB })
    await pool.query('drop schema public cascade; create schema public;')

    gateway = Bun.serve({
      port: GATEWAY_PORT,
      async fetch(req) {
        if (req.method === 'POST' && new URL(req.url).pathname === '/v1/x402/settle') {
          const body = (await req.json()) as { paymentPayload?: { payload?: { authorization?: { to: string; value: string } } } }
          if (gatewayDelayMs) await Bun.sleep(gatewayDelayMs)
          const auth = body.paymentPayload?.payload?.authorization
          settled.push({ to: String(auth?.to), value: String(auth?.value) })
          return Response.json({ success: true, transaction: crypto.randomUUID(), network: 'eip155:5042002' })
        }
        return Response.json({ status: 'completed' })
      },
    })

    api = Bun.spawn(['bun', 'run', './tickstream/apps/api/src/server.ts'], {
      env: {
        ...process.env,
        DATABASE_URL: DB,
        REDIS_URL: REDIS,
        SESSION_SECRET: 'x'.repeat(32),
        API_PORT: String(API_PORT),
        GATEWAY_API_URL: `http://127.0.0.1:${GATEWAY_PORT}`,
        STORAGE_DIR: '/tmp/ts-test-storage',
        TMP_DIR: '/tmp/ts-test-tmp',
      },
      stdout: 'ignore',
      stderr: 'inherit',
    })
    for (let i = 0; i < 80; i += 1) {
      try {
        if ((await fetch(`${API}/health`)).ok) break
      } catch {
        // still starting
      }
      await Bun.sleep(250)
    }

    client = await import('@/lib/api')
    payments = await import('@/components/player/payments')
    const nonce = (await (await fetch(`${API}/auth/nonce`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: viewer.address }) })).json()) as { message: string }
    const verified = (await (
      await fetch(`${API}/auth/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: viewer.address, signature: await viewer.signMessage({ message: nonce.message }) }),
      })
    ).json()) as { token: string }
    token = verified.token
    client.setToken(token)
    await pool.query('insert into users (address, username) values ($1, $2)', [creator.address.toLowerCase(), 'creator_test'])
  })

  afterAll(async () => {
    api?.kill()
    gateway?.stop()
    await pool?.end()
  })

  test('every 2-second payment is price x 2 seconds and goes to the creator', async () => {
    const video = await createVideo(60, 100)
    const id = await startSession(video, 2)
    const before = settled.length
    for (let i = 0; i < 5; i += 1) {
      const result = await payments.payNextChunk(id, scheme)
      expect(result.amountMicro).toBe(200)
    }
    const mine = settled.slice(before)
    expect(mine).toHaveLength(5)
    expect(mine.every((s) => s.to.toLowerCase() === creator.address.toLowerCase() && s.value === '200')).toBe(true)
  })

  test('the last payment covers only the video that is left', async () => {
    const video = await createVideo(59.3, 100)
    const id = await startSession(video, 2)
    const amounts: number[] = []
    let last: Awaited<ReturnType<typeof payments.payNextChunk>> | undefined
    for (let i = 0; i < 60; i += 1) {
      const result = await payments.payNextChunk(id, scheme)
      if (result.complete) break
      amounts.push(result.amountMicro)
      last = result
    }
    expect(amounts).toHaveLength(30)
    expect(amounts[29]).toBe(130)
    expect(last?.session.spentMicro).toBe(5930)
    expect(last?.nextPaymentRequired).toBeNull()
  })

  test('a payment after the whole video is paid charges nothing', async () => {
    const video = await createVideo(10, 100)
    const id = await startSession(video, 2)
    for (let i = 0; i < 5; i += 1) await payments.payNextChunk(id, scheme)
    const count = settled.length
    const extra = await payments.payNextChunk(id, scheme)
    expect(extra.amountMicro).toBe(0)
    expect(settled.length).toBe(count)
  })

  test('the spending limit stops payments', async () => {
    const video = await createVideo(60, 100)
    const id = await startSession(video, 2, 400)
    await payments.payNextChunk(id, scheme)
    await payments.payNextChunk(id, scheme)
    await expect(payments.payNextChunk(id, scheme)).rejects.toMatchObject({ code: 'cap_reached' })
  })

  test('a signed payment for the wrong amount is refused before anything settles', async () => {
    const video = await createVideo(60, 100)
    const id = await startSession(video, 2)
    const first = await fetch(`${API}/sessions/${id}/grant`, { method: 'POST', headers: headers(), body: '{}' })
    const need = (await first.json()) as { paymentRequired: { resource: unknown; accepts: Array<Record<string, unknown>> } }
    const bad = { ...need.paymentRequired.accepts[0], amount: '1' }
    const payload = await scheme.createPaymentPayload(2, bad as never)
    const before = settled.length
    const response = await fetch(`${API}/sessions/${id}/grant`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ payment: btoa(JSON.stringify({ ...payload, resource: need.paymentRequired.resource, accepted: bad })) }),
    })
    expect(response.status).toBe(402)
    expect(((await response.json()) as { code: string }).code).toBe('amount_mismatch')
    expect(settled.length).toBe(before)
  })

  test('seeking while a payment is in flight never leaves the paid window broken', async () => {
    const video = await createVideo(120, 100)
    const id = await startSession(video, 2)
    gatewayDelayMs = 700
    try {
      const paying = payments.payNextChunk(id, scheme)
      await Bun.sleep(150)
      const seeking = client.api(`sessions/${id}/seek`, { method: 'POST', body: { second: 80 } })
      await Promise.all([paying, seeking])
    } finally {
      gatewayDelayMs = 0
    }
    const state = await client.api<{ session: { startSecond: number; authorizedEndSecond: number } }>(`sessions/${id}`)
    expect(state.session.startSecond).toBe(80)
    expect(state.session.authorizedEndSecond).toBeGreaterThanOrEqual(state.session.startSecond)
  })

  test('a blank number is refused, not read as zero', async () => {
    const response = await fetch(`${API}/videos`, { method: 'POST', headers: headers(), body: JSON.stringify({ title: 'Blank price', priceMicro: '' }) })
    expect(response.status).toBe(400)
  })

  test('comments on a removed video are gone, and the feed shows followed creators only', async () => {
    const video = await createVideo(30, 100)
    const posted = await fetch(`${API}/videos/${video}/comments`, { method: 'POST', headers: headers(), body: JSON.stringify({ body: 'hello' }) })
    expect(posted.status).toBe(201)
    await pool.query(`update videos set status = 'removed' where id = $1`, [video])
    expect((await fetch(`${API}/videos/${video}/comments`)).status).toBe(404)

    await pool.query(`update videos set status = 'ready' where id = $1`, [video])
    expect((await client.api<{ videos: unknown[] }>('me/feed')).videos).toHaveLength(0)
    await client.api('creators/creator_test/follow', { method: 'PUT' })
    const feed = await client.api<{ videos: Array<{ creator: { username: string } }> }>('me/feed')
    expect(feed.videos.length).toBeGreaterThan(0)
    expect(feed.videos.every((v) => v.creator.username === 'creator_test')).toBe(true)
  })
})
