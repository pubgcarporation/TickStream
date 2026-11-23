import { useEffect, useState } from 'react'
import { shortAddress } from '@/lib/format'

const SPOTS = [
  { top: '8%', left: '5%' },
  { top: '10%', right: '5%' },
  { bottom: '18%', right: '6%' },
  { bottom: '20%', left: '6%' },
  { top: '45%', left: '40%' },
]

/**
 * A faint moving label with the viewer's wallet and session. It does not stop screen recording,
 * but it makes a leaked recording traceable to the session that made it.
 */
export function Watermark({ address, sessionId }: { address: string; sessionId: string }) {
  const [index, setIndex] = useState(0)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((value) => (value + 1) % SPOTS.length)
      setNow(new Date())
    }, 12_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div
      aria-hidden
      className="mono pointer-events-none absolute select-none whitespace-nowrap text-[10px] font-medium text-white/35 transition-all duration-1000"
      style={SPOTS[index]}
    >
      {shortAddress(address)} · {sessionId.slice(0, 8)} · {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </div>
  )
}
