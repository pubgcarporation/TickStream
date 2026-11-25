import { Pause, ShieldCheck, Timer } from 'lucide-react'
import type { VideoSummary } from '@shared/types'
import { Sheet, Skeleton } from '@/components/ui/primitives'
import { PriceCalculator } from '@/components/video/PriceCalculator'
import { useApi } from '@/hooks/useApi'

const STEPS = [
  { icon: Timer, title: 'Pay by the second', body: 'Each video shows its price per second. You are charged only for the seconds that play.' },
  { icon: Pause, title: 'Pause and the meter stops', body: 'Close the tab or hit pause and nothing more is charged. The most at risk is about one second.' },
  { icon: ShieldCheck, title: 'Capped by you', body: 'Set a spending cap before you press play. The server enforces it, not the page.' },
]

/** The "Learn more" panel from the sidebar: a live price calculator plus the three rules of the product. */
export function HowItWorksSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, loading } = useApi<{ videos: VideoSummary[] }>(open ? 'videos?sort=trending&limit=1' : null)
  const sample = data?.videos[0]
  return (
    <Sheet open={open} onClose={onClose} title="Pay per second with USDC">
      <div className="max-h-[70dvh] space-y-4 overflow-y-auto">
        {loading && !data ? <Skeleton className="h-56" /> : sample ? <PriceCalculator video={sample} /> : null}
        <ul className="space-y-3 border-t border-[var(--border)] pt-4">
          {STEPS.map((step) => (
            <li key={step.title} className="flex gap-3">
              <step.icon className="mt-0.5 size-5 shrink-0 text-[var(--accent)]" aria-hidden />
              <div>
                <p className="font-semibold">{step.title}</p>
                <p className="text-pretty text-sm text-[var(--muted)]">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
