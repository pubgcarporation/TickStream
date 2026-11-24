import path from 'node:path'
import { SEGMENT_SECONDS } from '@shared/constants'
import { ffmpegPath, run } from '../config/binaries'
import { ffmpegThreads } from '../config/concurrency'
import type { ProbeResult } from './probe'

/** Re-encodes to H.264 + AAC and cuts into AES-128 encrypted MPEG-TS segments of SEGMENT_SECONDS. */
export async function transcodeToHls(input: string, hlsDir: string, keyInfoFile: string, info: ProbeResult): Promise<string> {
  const playlist = path.join(hlsDir, 'index.m3u8')
  const threads = ffmpegThreads()
  const args = [
    '-y',
    '-i',
    input,
    ...(threads ? ['-threads', String(threads)] : []),
    '-map',
    '0:v:0',
    ...(info.hasAudio ? ['-map', '0:a:0'] : []),
    '-vf',
    'scale=-2:min(720\\,ih),format=yuv420p',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '23',
    '-profile:v',
    'main',
    '-force_key_frames',
    `expr:gte(t,n_forced*${SEGMENT_SECONDS})`,
    '-sc_threshold',
    '0',
    ...(info.hasAudio ? ['-c:a', 'aac', '-b:a', '128k', '-ac', '2'] : []),
    '-f',
    'hls',
    '-hls_time',
    String(SEGMENT_SECONDS),
    '-hls_playlist_type',
    'vod',
    '-hls_list_size',
    '0',
    '-hls_segment_type',
    'mpegts',
    '-hls_key_info_file',
    keyInfoFile,
    '-hls_segment_filename',
    path.join(hlsDir, 'seg_%05d.ts'),
    playlist,
  ]
  await run(ffmpegPath, args)
  return playlist
}
