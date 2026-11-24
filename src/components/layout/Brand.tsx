export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path
        d="M6 4.6c0-1.5 1.6-2.4 2.9-1.6l18.4 10.6c1.3.8 1.3 2.6 0 3.4L8.9 28.6C7.6 29.4 6 28.5 6 27z"
        fill="var(--accent)"
      />
      <path d="M12.4 11.2v9.6l8.3-4.8z" fill="#0f0f0f" />
    </svg>
  )
}

/** `compact` drops the name on very narrow phones so the header never crowds. */
export function Wordmark({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <BrandMark />
      <span className={`display text-xl font-bold tracking-tight${compact ? ' max-[389px]:hidden' : ''}`}>
        Tick<span className="text-[var(--accent)]">Stream</span>
      </span>
    </span>
  )
}
