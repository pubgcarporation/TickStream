import { query, queryOne } from '@shared/db'
import type { SegmentInfo, VideoStatus, VideoSummary } from '@shared/types'

export interface VideoRow {
  id: string
  creator: string
  title: string
  description: string
  category: string
  price_micro: number
  preview_seconds: number
  status: VideoStatus
  error: string | null
  duration_seconds: number | null
  segment_seconds: number
  segments: SegmentInfo[] | null
  iv: string | null
  key_hex: string | null
  source_key: string | null
  thumb_key: string | null
  views: number
  created_at: Date
  username: string
  display_name: string | null
}

const SELECT = `select v.*, u.username, u.display_name from videos v join users u on u.address = v.creator`

export function mapVideo(row: VideoRow): VideoSummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priceMicro: row.price_micro,
    previewSeconds: row.preview_seconds,
    durationSeconds: row.duration_seconds,
    status: row.status,
    views: row.views,
    createdAt: row.created_at.toISOString(),
    creator: { address: row.creator, username: row.username, displayName: row.display_name },
  }
}

export interface VideoFilter {
  creator?: string
  status?: VideoStatus
  /** Include videos taken down (admin only). */
  includeRemoved?: boolean
  exclude?: string
  category?: string
  q?: string
  sort: 'new' | 'trending' | 'price'
  limit: number
  offset: number
}

export async function listVideos(filter: VideoFilter): Promise<VideoSummary[]> {
  const where: string[] = []
  const params: unknown[] = []
  const push = (value: unknown) => {
    params.push(value)
    return `$${params.length}`
  }
  if (filter.status) where.push(`v.status = ${push(filter.status)}`)
  else if (!filter.includeRemoved) where.push(`v.status <> 'removed'`)
  if (filter.exclude) where.push(`v.id <> ${push(filter.exclude)}`)
  if (filter.creator) where.push(`v.creator = ${push(filter.creator)}`)
  if (filter.category) where.push(`v.category = ${push(filter.category)}`)
  if (filter.q) {
    const term = push(`%${filter.q.replace(/[%_\\]/g, '\\$&')}%`)
    where.push(`(v.title ilike ${term} or v.description ilike ${term} or u.username ilike ${term})`)
  }
  const order =
    filter.sort === 'trending'
      ? `(select coalesce(sum(p.seconds), 0) from payments p where p.video_id = v.id and p.created_at > now() - interval '7 days') desc, v.views desc, v.created_at desc`
      : filter.sort === 'price'
        ? 'v.price_micro asc, v.created_at desc'
        : 'v.created_at desc'
  const limit = push(filter.limit)
  const offset = push(filter.offset)
  const rows = await query<VideoRow>(
    `${SELECT} where ${where.join(' and ')} order by ${order} limit ${limit} offset ${offset}`,
    params,
  )
  return rows.map(mapVideo)
}

export async function getVideoRow(id: string): Promise<VideoRow | undefined> {
  return queryOne<VideoRow>(`${SELECT} where v.id = $1`, [id])
}
