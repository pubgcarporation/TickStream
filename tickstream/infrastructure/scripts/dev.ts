import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Starts the datastores (Postgres, Redis) and the three TickStream services with prefixed logs. */
const root = fileURLToPath(new URL('../../../', import.meta.url))
const compose = fileURLToPath(new URL('../docker/docker-compose.yml', import.meta.url))

const up = spawnSync('docker', ['compose', '-f', compose, 'up', '-d', '--wait'], { stdio: 'inherit' })
if (up.status !== 0) {
  console.error('[stack] could not start Postgres and Redis. Is Docker running?')
  process.exit(1)
}

const services = [
  { name: 'api', script: 'tickstream/apps/api/src/server.ts' },
  { name: 'media', script: 'tickstream/apps/media-worker/src/index.ts' },
  { name: 'settlement', script: 'tickstream/apps/settlement-worker/src/index.ts' },
]

const children: ChildProcess[] = []

for (const service of services) {
  const child = spawn(process.execPath, ['run', service.script], { cwd: root, env: process.env })
  const prefix = `[${service.name}] `
  const pipe = (data: Buffer) => {
    for (const line of data.toString().split('\n')) if (line.trim()) console.log(prefix + line)
  }
  child.stdout?.on('data', pipe)
  child.stderr?.on('data', pipe)
  child.on('exit', (code) => console.log(`${prefix}exited with ${code}`))
  children.push(child)
}

const stop = () => {
  for (const child of children) child.kill()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
