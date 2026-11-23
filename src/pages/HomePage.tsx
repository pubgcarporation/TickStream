import { ArrowRight, Pause, ShieldCheck, Timer } from 'lucide-react'
import { useMemo } from 'react'
import { CATEGORIES } from '@shared/constants'
import type { VideoSummary } from '@shared/types'
import { Button, EmptyState } from '@/components/ui/primitives'
import { PriceCalculator } from '@/components/video/PriceCalculator'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { Link, navigate } from '@/lib/router'

const STEPS = [
  {
    icon: Timer,
    title: 'Pay by the second',
    body: 'Every video shows its price per second. You are charged only for the seconds that play.',
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

function SectionHeader({ id, title, to, cta = 'See all' }: { id: string; title: string; to?: string; cta?: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 id={id} className="display text-2xl font-semibold">
        {title}
      </h2>
      {to && (
        <Link to={to} className="flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
          {cta} <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  )
}

export function HomePage() {
  const trending = useApi<{ videos: VideoSummary[] }>('videos?sort=trending&limit=8')
  const latest = useApi<{ videos: VideoSummary[] }>('videos?sort=new&limit=30')
  const sample = trending.data?.videos[0]

  const { fresh, previews } = useMemo(() => {
    const shown = new Set((trending.data?.videos ?? []).map((video) => video.id))
    const rest = (latest.data?.videos ?? []).filter((video) => !shown.has(video.id))
    return { fresh: rest.slice(0, 8), previews: (latest.data?.videos ?? []).filter((video) => video.previewSeconds > 0).slice(0, 4) }
  }, [trending.data, latest.data])

  const empty = trending.data !== null && trending.data.videos.length === 0

  return (
    <div className="space-y-20">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="mono text-xs uppercase tracking-[0.1em] text-[var(--accent)]">Streaming without subscriptions</p>
          <h1 className="display mt-4 text-balance text-5xl font-bold leading-[1.02] sm:text-7xl">Every second counts.</h1>
          <p className="mt-5 max-w-xl text-pretty text-lg text-[var(--muted)]">
            Watch anything. Pay only for what you watch, in USDC, down to the second. No plans, no renewals, no surprises.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => navigate('/explore')} className="px-7">
              Start watching <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Link to="/studio/upload" className="px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              Or upload a video and get paid per second
            </Link>
          </div>
        </div>
        {sample ? (
          <PriceCalculator key={sample.id} video={sample} />
        ) : (
          <div className="glass rise rounded-3xl p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--subtle)]">Per-second pricing</p>
            <p className="mt-3 max-w-sm text-pretty text-sm text-[var(--muted)]">
              Creators set a price per second. You see it before you press play, and drag a slider to see what any length costs.
            </p>
          </div>
        )}
      </section>

      {empty ? (
        <EmptyState
          title="No videos yet"
          body="Be the first to publish. Set a price per second and get paid as people watch."
          action={
            <Link to="/studio/upload" className="inline-flex min-h-11 items-center rounded-2xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)]">
              Upload a video
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="trending" className="space-y-6">
            <SectionHeader id="trending" title="Trending now" to="/explore?sort=trending" />
            <VideoGrid videos={trending.data?.videos ?? null} loading={trending.loading && !trending.data} />
          </section>

          {previews.length > 0 && (
            <section aria-labelledby="previews" className="space-y-6">
              <SectionHeader id="previews" title="Try before you pay" to="/explore" />
              <VideoGrid videos={previews} />
            </section>
          )}

          {fresh.length > 0 && (
            <section aria-labelledby="fresh" className="space-y-6">
              <SectionHeader id="fresh" title="Just uploaded" to="/explore?sort=new" />
              <VideoGrid videos={fresh} />
            </section>
          )}
        </>
      )}

      <section aria-labelledby="browse" className="space-y-5">
        <SectionHeader id="browse" title="Browse by topic" to="/categories" cta="All categories" />
        <ul className="flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <li key={category.slug}>
              <Link
                to={`/explore?category=${category.slug}`}
                className="glass-inner inline-flex min-h-11 items-center rounded-full px-5 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                {category.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="How it works" className="grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="glass rise rounded-3xl p-6" style={{ ['--i' as string]: index }}>
            <div className="flex items-center justify-between">
              <step.icon className="size-5 text-[var(--accent)]" aria-hidden />
              <span className="mono text-xs tabular-nums text-[var(--subtle)]">0{index + 1}</span>
            </div>
            <h3 className="display mt-5 text-lg font-semibold">{step.title}</h3>
            <p className="mt-2 text-pretty text-sm text-[var(--muted)]">{step.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
