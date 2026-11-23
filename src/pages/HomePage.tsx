import { ArrowRight, Pause, ShieldCheck, Timer } from 'lucide-react'
import type { VideoSummary } from '@shared/types'
import { Button } from '@/components/ui/primitives'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { formatMicro } from '@/lib/format'
import { Link, navigate } from '@/lib/router'

const STEPS = [
  {
    icon: Timer,
    title: 'Pay by the second',
    body: 'Each video shows its price per second. You are charged only for the seconds that play.',
  },
  {
    icon: Pause,
    title: 'Pause and the meter stops',
    body: 'Close the tab or hit pause and nothing more is charged. The most at risk is one short interval.',
  },
  {
    icon: ShieldCheck,
    title: 'Capped by you',
    body: 'Set a spending cap before you press play. The server enforces it, not the page.',
  },
]

export function HomePage() {
  const { data, loading } = useApi<{ videos: VideoSummary[] }>('videos?sort=trending&limit=8')
  const sample = data?.videos[0]
  return (
    <div className="space-y-16">
      <section className="grid items-end gap-10 pt-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="mono text-xs uppercase tracking-[0.1em] text-[var(--accent)]">Streaming without subscriptions</p>
          <h1 className="display mt-4 text-balance text-5xl font-bold leading-[1.02] sm:text-7xl">Every second counts.</h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-[var(--muted)]">
            Watch anything. Pay only for what you watch, in USDC, down to the second.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={() => navigate('/explore')} className="px-7">
              Start watching <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button variant="secondary" onClick={() => navigate('/studio/upload')}>
              Upload a video
            </Button>
          </div>
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">
            {sample ? 'What a minute costs' : 'Per-second pricing'}
          </p>
          {sample ? (
            <>
              <p className="display mt-3 text-5xl font-bold tabular-nums">
                ${formatMicro(sample.priceMicro * 60)}
                <span className="ml-2 text-lg font-medium text-[var(--subtle)]">USDC</span>
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                for 60 seconds of{' '}
                <Link to={`/watch/${sample.id}`} className="font-semibold text-[var(--ink)] underline-offset-4 hover:underline">
                  {sample.title}
                </Link>
                , priced at ${formatMicro(sample.priceMicro)} per second.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Creators set a price per second. You see it before you press play.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="trending" className="space-y-6">
        <div className="flex items-end justify-between">
          <h2 id="trending" className="display text-2xl font-semibold">
            Trending now
          </h2>
          <Link to="/explore?sort=trending" className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
            See all
          </Link>
        </div>
        <VideoGrid videos={data?.videos ?? null} loading={loading} />
      </section>

      <section aria-label="How it works" className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step) => (
          <div key={step.title} className="glass rounded-3xl p-6">
            <step.icon className="size-5 text-[var(--accent)]" aria-hidden />
            <h3 className="display mt-4 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-pretty text-sm text-[var(--muted)]">{step.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
