import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { closeDb, migrate, query, queryOne } from '../../packages/shared/src/db'
import { env } from '../../packages/shared/src/env'
import { getStorage, storageKeys } from '../../packages/shared/src/storage'
import { ffmpegPath, run } from '../../apps/media-worker/src/config/binaries'
import { processVideo } from '../../apps/media-worker/src/workers/transcode.worker'

/**
 * Adds a handful of generated demo clips (synthetic visuals and tones made with ffmpeg, no stock footage)
 * so the library is not empty. Their payments go to a demo creator address generated on first run;
 * the key stays in tickstream/.data and is never committed.
 */

interface DemoSpec {
  title: string
  description: string
  category: string
  priceMicro: number
  seconds: number
  video: string
  audio: string
}

const SIZE = '640x360'
const DEMOS: DemoSpec[] = [
  {
    title: 'Gradient Drift',
    description: 'A slow generative gradient with a low ambient tone. A demo clip for trying per-second playback.',
    category: 'music',
    priceMicro: 150,
    seconds: 60,
    video: `gradients=size=${SIZE}:rate=30:speed=0.03:nb_colors=4`,
    audio: 'sine=frequency=174:sample_rate=44100',
  },
  {
    title: 'Cellular Bloom',
    description: 'Conway-style cellular automata growing across the frame. Generated, not filmed.',
    category: 'tech',
    priceMicro: 220,
    seconds: 45,
    video: `life=size=${SIZE}:rate=30:ratio=0.08:mold=12:life_color=#2de3a0:death_color=#0d1b2f,format=yuv420p`,
    audio: 'sine=frequency=261:sample_rate=44100',
  },
  {
    title: 'Signal Check',
    description: 'A moving test pattern with a steady tone. Short and cheap to watch, ideal for a first payment.',
    category: 'learning',
    priceMicro: 80,
    seconds: 30,
    video: `testsrc2=size=${SIZE}:rate=30`,
    audio: 'sine=frequency=440:sample_rate=44100',
  },
  {
    title: 'Pattern Garden',
    description: 'Rule-based patterns drifting downwards in color. Generated as a visual loop.',
    category: 'film',
    priceMicro: 300,
    seconds: 75,
    video: `cellauto=size=${SIZE}:rate=30:rule=110:random_fill_ratio=0.2:scroll=1,format=yuv420p`,
    audio: 'sine=frequency=196:sample_rate=44100',
  },
  {
    title: 'Color Bars Long Take',
    description: 'A two-minute RGB test card with a gentle tone, for watching how the meter counts a longer session.',
    category: 'lifestyle',
    priceMicro: 120,
    seconds: 120,
    video: `rgbtestsrc=size=${SIZE}:rate=30`,
    audio: 'sine=frequency=330:sample_rate=44100',
  },
]

async function demoCreator(): Promise<string> {
  const file = path.join(env.dataDir, 'demo-creator.json')
  await mkdir(env.dataDir, { recursive: true })
  let record: { address: string; privateKey: string } | undefined
  try {
    record = JSON.parse(await readFile(file, 'utf8')) as { address: string; privateKey: string }
  } catch {
    const privateKey = generatePrivateKey()
    record = { address: privateKeyToAccount(privateKey).address.toLowerCase(), privateKey }
    await writeFile(file, JSON.stringify(record, null, 2), { mode: 0o600 })
  }
  await query(
    `insert into users (address, username, display_name, bio) values ($1, 'tickstream_originals', 'TickStream Originals', 'Generated demo clips for trying pay-per-second playback.')
     on conflict (address) do nothing`,
    [record.address],
  )
  return record.address
}

async function generate(spec: DemoSpec, out: string): Promise<void> {
  await run(ffmpegPath, [
    '-y',
    '-f', 'lavfi', '-i', spec.video,
    '-f', 'lavfi', '-i', spec.audio,
    '-t', String(spec.seconds),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '96k',
    '-shortest',
    out,
  ])
}

async function main() {
  await migrate()
  const creator = await demoCreator()
  const scratch = path.join(env.tmpDir, 'seed')
  await mkdir(scratch, { recursive: true })
  for (const spec of DEMOS) {
    const exists = await queryOne('select 1 from videos where creator = $1 and title = $2 and status <> $3', [creator, spec.title, 'removed'])
    if (exists) {
      console.log(`[seed] ${spec.title}: already there`)
      continue
    }
    const rows = await query<{ id: string }>(
      `insert into videos (creator, title, description, category, price_micro, preview_seconds) values ($1, $2, $3, $4, $5, $6) returning id`,
      [creator, spec.title, spec.description, spec.category, spec.priceMicro, spec.title === 'Gradient Drift' || spec.title === 'Signal Check' ? 10 : 0],
    )
    const id = rows[0]?.id
    if (!id) continue
    const file = path.join(scratch, `${id}.mp4`)
    await generate(spec, file)
    const key = storageKeys.source(id)
    await getStorage().putFile(key, file, 'video/mp4')
    await query(`update videos set status = 'processing', source_key = $2 where id = $1`, [id, key])
    await processVideo(id)
    await rm(file, { force: true })
    console.log(`[seed] ${spec.title}: ready`)
  }
  console.log(`[seed] demo creator address: ${creator}`)
  await closeDb()
}

main().catch((error: unknown) => {
  console.error('[seed] failed', error)
  process.exit(1)
})
