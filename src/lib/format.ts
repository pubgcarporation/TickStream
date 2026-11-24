import { formatUsdc } from '@/onchain-money'

/** USDC base units (integer, 6 decimals) to a display string with at least 2 and at most 6 decimals. */
export function formatMicro(micro: number | bigint): string {
  if (typeof micro === 'number' && !Number.isFinite(micro)) return '0.00'
  const raw = typeof micro === 'bigint' ? micro : BigInt(Math.round(micro))
  const exact = formatUsdc(raw)
  const [whole, fraction = ''] = exact.split('.')
  const trimmed = fraction.replace(/0+$/, '')
  return `${whole}.${trimmed.padEnd(2, '0')}`
}

export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '--:--'
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function timeAgo(iso: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** What watching costs at a per-second price, shown as a rate viewers can reason about. */
export function ratePerMinute(priceMicro: number): string {
  return formatMicro(priceMicro * 60)
}

export function ratePerHour(priceMicro: number): string {
  return formatMicro(priceMicro * 3600)
}

/** 1.2K, 3.4M: short counts for card meta lines. */
export function compactNumber(value: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

/** The creator's name as shown on cards. Usernames are for addresses and links, so a creator without a display name reads as "Creator". */
export function creatorLabel(creator: { displayName: string | null }): string {
  return creator.displayName?.trim() || 'Creator'
}

/** "1 view", "1.2K views". */
export function viewsLabel(views: number): string {
  return `${compactNumber(views)} ${views === 1 ? 'view' : 'views'}`
}

/** "just now", "5 minutes ago", "3 days ago", "2 months ago": the way video sites write a video's age. */
export function timeAgoLong(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  const units: Array<[string, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [name, size] of units) {
    const count = Math.floor(seconds / size)
    if (count >= 1) return `${count} ${name}${count === 1 ? '' : 's'} ago`
  }
  return 'just now'
}
