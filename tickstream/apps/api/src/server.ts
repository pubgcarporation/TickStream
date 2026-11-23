import { createServer } from 'node:http'
import { env } from '@shared/env'
import { closeDb, migrate } from '@shared/db'
import { getRedis } from '@shared/redis'
import { handle } from './app'

async function main() {
  await migrate()
  await getRedis().ping()
  const server = createServer((req, res) => {
    void handle(req, res)
  })
  server.requestTimeout = 0
  server.listen(env.apiPort, '0.0.0.0', () => {
    console.log(`[api] listening on :${env.apiPort}`)
  })

  const shutdown = () => {
    server.close()
    void closeDb().finally(() => process.exit(0))
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((error: unknown) => {
  console.error('[api] failed to start', error)
  process.exit(1)
})
