import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import ffmpegStatic from 'ffmpeg-static'

const require = createRequire(import.meta.url)

function resolveFfmpeg(): string {
  const fromEnv = process.env.FFMPEG_PATH
  const path = fromEnv || ffmpegStatic
  if (!path) throw new Error('ffmpeg is not available. Install ffmpeg-static or set FFMPEG_PATH.')
  return path
}

function resolveFfprobe(): string {
  const fromEnv = process.env.FFPROBE_PATH
  if (fromEnv) return fromEnv
  const probe = require('ffprobe-static') as { path?: string }
  if (!probe.path) throw new Error('ffprobe is not available. Install ffprobe-static or set FFPROBE_PATH.')
  return probe.path
}

export const ffmpegPath = resolveFfmpeg()
export const ffprobePath = resolveFfprobe()

export interface RunResult {
  stdout: string
  stderr: string
}

/** Runs a binary without a shell and rejects with the tail of stderr on a non-zero exit. */
export function run(binary: string, args: string[]): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${binary.split('/').pop()} exited with ${code}: ${stderr.slice(-600)}`))
    })
  })
}
