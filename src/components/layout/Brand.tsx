export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#acc6e9" />
      <path d="M8 21h4v-5h3V11h3v10h3v-7h3" stroke="#0d1b2f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark />
      <span className="display text-lg font-bold tracking-tight">TickStream</span>
    </span>
  )
}
