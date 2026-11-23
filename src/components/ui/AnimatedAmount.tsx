import { clsx } from 'clsx'
import { useEffect, useRef, useState } from 'react'
import { formatMicro } from '@/lib/format'

/**
 * A USDC amount that eases toward its real value instead of jumping. It only moves when the underlying
 * number changes, so what you see is always the live figure, just delivered smoothly. The text is written
 * straight to the element each frame, so easing never re-renders the page.
 */
export function AnimatedAmount({ micro, className }: { micro: number; className?: string }) {
  const node = useRef<HTMLSpanElement | null>(null)
  const current = useRef(micro)
  const frame = useRef(0)
  // The rendered text never changes, so React leaves the node alone and the easing owns it after mount.
  const [initial] = useState(() => formatMicro(Math.round(micro)))

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const tick = () => {
      const diff = micro - current.current
      current.current = reduce || Math.abs(diff) < 1 ? micro : current.current + diff * 0.2
      if (node.current) node.current.textContent = formatMicro(Math.round(current.current))
      if (current.current !== micro) frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame.current)
  }, [micro])

  return (
    <span ref={node} className={clsx('tabular-nums', className)}>
      {initial}
    </span>
  )
}
