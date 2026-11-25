import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { closeDb, migrate, query, queryOne } from '@shared/db'
import { env } from '@shared/env'
import { getStorage, storageKeys } from '@shared/storage'
import { ffmpegPath, run } from './config/binaries'
import { processVideo } from './workers/transcode.worker'

/**
 * Fills the library with ten generated clips from six made-up creators, each with their own wallet and picture.
 *
 * The clips are made with ffmpeg: synthetic visuals and tones, no game footage, no film footage, no real music.
 * Titles say what a channel like this would make, and every description says the clip is generated.
 *
 * Each creator gets a fresh wallet. The keys are saved to tickstream/.data/demo-catalog-wallets.json (on the VPS,
 * inside the data volume) and are never printed or committed. Any USDC a viewer pays these creators is sent to those
 * addresses, so keep that file if you want to withdraw it. Running this again adds nothing that is already there.
 */

interface CreatorSpec {
  username: string
  displayName: string
  bio: string
  /** Three colours for the profile picture. */
  colors: [string, string, string]
}

interface ClipSpec {
  creator: string
  title: string
  description: string
  category: string
  priceMicro: number
  seconds: number
  previewSeconds: number
  video: string
  audio: string
}

const SIZE = '640x360'
const NOTE = 'A generated demo clip: synthetic visuals and a tone, no game footage.'
const NOTE_MUSIC = 'A generated demo clip: synthetic visuals and a made-up tone, not a real song.'
const NOTE_LEARN = 'A generated demo clip: synthetic visuals and a tone, not a real lesson.'

/** A soft chord from three sine waves that slowly swells, written as an expression so no audio file is needed. */
const chord = (a: number, b: number, c: number, swell = 0.4) =>
  `aevalsrc=exprs=(0.55+0.45*sin(2*PI*${swell}*t))*(0.22*sin(2*PI*${a}*t)+0.18*sin(2*PI*${b}*t)+0.16*sin(2*PI*${c}*t)):sample_rate=44100`

const CREATORS: CreatorSpec[] = [
  {
    username: 'vice_city_watch',
    displayName: 'Vice City Watch',
    bio: 'Open-world game news and trailer breakdowns. Demo channel with generated clips.',
    colors: ['0xff4fa3', '0xffa94d', '0x3a0ca3'],
  },
  {
    username: 'map_breakdowns',
    displayName: 'Map Breakdowns',
    bio: 'Maps, sizes and numbers from big games. Demo channel with generated clips.',
    colors: ['0x2dd4bf', '0x1e3a8a', '0x0f172a'],
  },
  {
    username: 'promptlab',
    displayName: 'Prompt Lab',
    bio: 'Plain-language AI lessons for beginners. Demo channel with generated clips.',
    colors: ['0x8b5cf6', '0x22d3ee', '0x111827'],
  },
  {
    username: 'neural_notes',
    displayName: 'Neural Notes',
    bio: 'The ideas behind machine learning, one short lesson at a time. Demo channel with generated clips.',
    colors: ['0xf97316', '0xfacc15', '0x7c2d12'],
  },
  {
    username: 'lofi_harbor',
    displayName: 'Lofi Harbor',
    bio: 'Calm mixes for studying and late drives. Demo channel with generated clips.',
    colors: ['0x60a5fa', '0xc4b5fd', '0x1e1b4b'],
  },
  {
    username: 'neon_pulse',
    displayName: 'Neon Pulse',
    bio: 'Electronic visualizers and synthwave. Demo channel with generated clips.',
    colors: ['0xf43f5e', '0x06b6d4', '0x1a0b2e'],
  },
]

const CLIPS: ClipSpec[] = [
  {
    creator: 'vice_city_watch',
    title: 'GTA 6 Trailer Breakdown: Every Detail Explained',
    description: `Frame-by-frame talking points for the GTA 6 trailer, in the style of a breakdown channel. ${NOTE}`,
    category: 'gaming',
    priceMicro: 380,
    seconds: 75,
    previewSeconds: 10,
    video: `gradients=size=${SIZE}:rate=30:speed=0.05:nb_colors=3:c0=0xff4fa3:c1=0xffa94d:c2=0x3a0ca3`,
    audio: chord(110, 138.6, 164.8),
  },
  {
    creator: 'vice_city_watch',
    title: 'GTA 6 Release Date Rumours Ranked',
    description: `Which release-date rumours hold up and which do not, ranked. ${NOTE}`,
    category: 'gaming',
    priceMicro: 300,
    seconds: 55,
    previewSeconds: 0,
    video: `testsrc2=size=${SIZE}:rate=30`,
    audio: chord(146.8, 185, 220, 0.3),
  },
  {
    creator: 'map_breakdowns',
    title: 'GTA 6 Map Size vs GTA 5: The Numbers',
    description: `How the new map is said to compare with the last one, with the numbers laid out. ${NOTE}`,
    category: 'gaming',
    priceMicro: 260,
    seconds: 65,
    previewSeconds: 8,
    video: `mandelbrot=size=${SIZE}:rate=30`,
    audio: chord(130.8, 164.8, 196, 0.25),
  },
  {
    creator: 'promptlab',
    title: 'Prompt Engineering in 10 Minutes: Beginner Guide',
    description: `Write clearer prompts and get better answers from AI tools. ${NOTE_LEARN}`,
    category: 'learning',
    priceMicro: 160,
    seconds: 90,
    previewSeconds: 15,
    video: `life=size=${SIZE}:rate=30:ratio=0.08:mold=12:life_color=#8b5cf6:death_color=#0b1020,format=yuv420p`,
    audio: chord(196, 246.9, 293.7, 0.2),
  },
  {
    creator: 'promptlab',
    title: 'How Large Language Models Actually Work',
    description: `Tokens, attention and next-word prediction explained without the maths. ${NOTE_LEARN}`,
    category: 'learning',
    priceMicro: 200,
    seconds: 80,
    previewSeconds: 0,
    video: `cellauto=size=${SIZE}:rate=30:rule=110:random_fill_ratio=0.2:scroll=1,format=yuv420p`,
    audio: chord(174.6, 220, 261.6, 0.3),
  },
  {
    creator: 'neural_notes',
    title: 'Neural Networks From Scratch: The Intuition',
    description: `Neurons, weights and learning as a picture you can hold in your head. ${NOTE_LEARN}`,
    category: 'learning',
    priceMicro: 140,
    seconds: 70,
    previewSeconds: 10,
    video: `sierpinski=size=${SIZE}:rate=30`,
    audio: chord(164.8, 207.7, 246.9, 0.35),
  },
  {
    creator: 'neural_notes',
    title: 'Build Your First AI Agent: Step by Step',
    description: `From a blank file to a small agent that can use tools, in plain steps. ${NOTE_LEARN}`,
    category: 'tech',
    priceMicro: 220,
    seconds: 60,
    previewSeconds: 0,
    video: `life=size=${SIZE}:rate=30:ratio=0.1:mold=10:life_color=#f97316:death_color=#1a0f05,format=yuv420p`,
    audio: chord(185, 233, 277.2, 0.28),
  },
  {
    creator: 'lofi_harbor',
    title: 'Midnight Drive: Synthwave Mix',
    description: `A long, slow mix for night drives. ${NOTE_MUSIC}`,
    category: 'music',
    priceMicro: 90,
    seconds: 90,
    previewSeconds: 12,
    video: `gradients=size=${SIZE}:rate=30:speed=0.03:nb_colors=3:c0=0x60a5fa:c1=0xc4b5fd:c2=0x1e1b4b`,
    audio: chord(110, 130.8, 164.8, 0.18),
  },
  {
    creator: 'lofi_harbor',
    title: 'Rainy Window: Lo-fi Beats to Study To',
    description: `Soft, steady tones for focus. ${NOTE_MUSIC}`,
    category: 'music',
    priceMicro: 70,
    seconds: 85,
    previewSeconds: 10,
    video: `gradients=size=${SIZE}:rate=30:speed=0.02:nb_colors=3:c0=0x38bdf8:c1=0x334155:c2=0x0f172a`,
    audio: chord(98, 123.5, 146.8, 0.15),
  },
  {
    creator: 'neon_pulse',
    title: 'Neon Pulse - Electric Dreams (Visualizer)',
    description: `A bright, fast visualizer. ${NOTE_MUSIC}`,
    category: 'music',
    priceMicro: 130,
    seconds: 50,
    previewSeconds: 8,
    video: `rgbtestsrc=size=${SIZE}:rate=30`,
    audio: chord(220, 277.2, 329.6, 0.9),
  },
]

type Wallets = Record<string, { address: string; privateKey: string }>

/** One wallet per creator. Made on the first run and kept, so running again reuses the same addresses. */
async function loadWallets(): Promise<Wallets> {
  const file = path.join(env.dataDir, 'demo-catalog-wallets.json')
  await mkdir(env.dataDir, { recursive: true })
  let wallets: Wallets = {}
  try {
    wallets = JSON.parse(await readFile(file, 'utf8')) as Wallets
  } catch {
    // First run: nothing saved yet.
  }
  let changed = false
  for (const creator of CREATORS) {
    if (wallets[creator.username]) continue
    const privateKey = generatePrivateKey()
    wallets[creator.username] = { address: privateKeyToAccount(privateKey).address.toLowerCase(), privateKey }
    changed = true
  }
  if (changed) await writeFile(file, JSON.stringify(wallets, null, 2), { mode: 0o600 })
  return wallets
}

async function makeAvatar(creator: CreatorSpec, out: string): Promise<Buffer> {
  const [c0, c1, c2] = creator.colors
  await run(ffmpegPath, [
    '-y',
    '-f', 'lavfi', '-i', `gradients=size=256x256:rate=1:nb_colors=3:c0=${c0}:c1=${c1}:c2=${c2}:x0=0:y0=0:x1=256:y1=256`,
    '-frames:v', '1',
    '-q:v', '3',
    out,
  ])
  return readFile(out)
}

async function makeClip(spec: ClipSpec, out: string): Promise<void> {
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
  const wallets = await loadWallets()
  const scratch = path.join(env.tmpDir, 'seed-catalog')
  await mkdir(scratch, { recursive: true })

  for (const creator of CREATORS) {
    const wallet = wallets[creator.username]
    if (!wallet) continue
    await query(
      `insert into users (address, username, display_name, bio) values ($1, $2, $3, $4) on conflict (address) do nothing`,
      [wallet.address, creator.username, creator.displayName, creator.bio],
    )
    const user = await queryOne<{ avatar_key: string | null }>('select avatar_key from users where address = $1', [wallet.address])
    if (user && !user.avatar_key) {
      const picture = await makeAvatar(creator, path.join(scratch, `${creator.username}.jpg`))
      const key = storageKeys.avatar(wallet.address, 'jpg')
      await getStorage().putBuffer(key, picture, 'image/jpeg')
      await query('update users set avatar_key = $2, avatar_updated_at = now() where address = $1', [wallet.address, key])
      console.log(`[catalog] ${creator.displayName}: picture added`)
    }
  }

  for (const spec of CLIPS) {
    const wallet = wallets[spec.creator]
    if (!wallet) continue
    const exists = await queryOne('select 1 from videos where creator = $1 and title = $2 and status <> $3', [wallet.address, spec.title, 'removed'])
    if (exists) {
      console.log(`[catalog] ${spec.title}: already there`)
      continue
    }
    const rows = await query<{ id: string }>(
      `insert into videos (creator, title, description, category, price_micro, preview_seconds) values ($1, $2, $3, $4, $5, $6) returning id`,
      [wallet.address, spec.title, spec.description, spec.category, spec.priceMicro, spec.previewSeconds],
    )
    const id = rows[0]?.id
    if (!id) continue
    const file = path.join(scratch, `${id}.mp4`)
    await makeClip(spec, file)
    const key = storageKeys.source(id)
    await getStorage().putFile(key, file, 'video/mp4')
    await query(`update videos set status = 'processing', source_key = $2 where id = $1`, [id, key])
    await processVideo(id)
    await rm(file, { force: true })
    console.log(`[catalog] ${spec.title}: ready`)
  }

  console.log('[catalog] creators and their payment addresses:')
  for (const creator of CREATORS) console.log(`  ${creator.displayName} (@${creator.username}): ${wallets[creator.username]?.address}`)
  await closeDb()
  // The queue connection would keep the process open, so end it here.
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error('[catalog] failed', error)
  process.exit(1)
})
