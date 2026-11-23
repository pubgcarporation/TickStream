interface AmountInputProps {
  value: string
  onChange: (value: string) => void
  /** Spendable amount shown beside "Max", already formatted. */
  balanceLabel?: string
  onMax?: () => void
  chips?: string[]
  disabled?: boolean
}

export function AmountInput({ value, onChange, balanceLabel, onMax, chips, disabled }: AmountInputProps) {
  return (
    <div className="glass-inner rounded-2xl p-4">
      <div className="flex items-baseline gap-2">
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value.replace(/,/g, '.')
            if (next === '' || /^\d*\.?\d{0,6}$/.test(next)) onChange(next)
          }}
          placeholder="0.00"
          aria-label="Amount in USDC"
          className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-white/20"
        />
        <span className="text-sm font-medium text-[var(--subtle)]">USDC</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {chips?.map((chip) => (
            <button
              key={chip}
              type="button"
              disabled={disabled}
              onClick={() => onChange(chip)}
              className="min-h-9 rounded-full bg-white/10 px-3 text-xs font-semibold tabular-nums text-[var(--muted)] hover:bg-white/15 hover:text-[var(--ink)] disabled:opacity-40"
            >
              {chip}
            </button>
          ))}
        </div>
        {balanceLabel && (
          <button
            type="button"
            onClick={onMax}
            disabled={disabled || !onMax}
            className="min-h-9 text-xs font-semibold tabular-nums text-[var(--accent)] disabled:opacity-60"
          >
            {balanceLabel}
            {onMax ? ' · Max' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
