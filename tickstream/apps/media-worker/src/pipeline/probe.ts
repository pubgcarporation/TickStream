import { ffprobePath, run } from '../config/binaries'

export interface ProbeResult {
  durationSeconds: number
  hasVideo: boolean
  hasAudio: boolean
  width: number
  height: number
}

interface ProbeJson {
  format?: { duration?: string }
  streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>
}

export async function probe(file: string): Promise<ProbeResult> {
  const { stdout } = await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file])
  const data = JSON.parse(stdout) as ProbeJson
  const streams = data.streams ?? []
  const video = streams.find((s) => s.codec_type === 'video')
  const audio = streams.find((s) => s.codec_type === 'audio')
  const duration = Number(data.format?.duration ?? video?.duration ?? 0)
  return {
    durationSeconds: Number.isFinite(duration) ? duration : 0,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    width: video?.width ?? 0,
    height: video?.height ?? 0,
  }
}
