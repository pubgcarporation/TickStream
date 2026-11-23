import { formatUsdc } from '@/onchain-money'

/** USDC base units (integer, 6 decimals) to a display string with at least 2 and at most 6 decimals. */
export function formatMicro(micro: number | bigint): string {
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
