import { Pause, ShieldCheck, Timer } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { VideoSummary } from '@shared/types'
import { EmptyState } from '@/components/ui/primitives'
import { CategoryChips } from '@/components/video/CategoryChips'
import { VideoGrid } from '@/components/video/VideoGrid'
import { useApi } from '@/hooks/useApi'
import { Link } from '@/lib/router'

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

function SectionHeader({ id, title, to }: { id: string; title: string; to?: string }) {
  return (
    <div className="flex items-end justify-between">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {to && (
        <Link to={to} className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]">
          See all
        </Link>
      )}
    </div>
  )
}

export function HomePage() {
  const [category, setCategory] = useState('')
  const filtered = useApi<{ videos: VideoSummary[] }>(category ? `videos?category=${category}&sort=trending&limit=48` : null)
  const trending = useApi<{ videos: VideoSummary[] }>('videos?sort=trending&limit=8')
  const latest = useApi<{ videos: VideoSummary[] }>('videos?sort=new&limit=30')

  const { fresh, previews } = useMemo(() => {
    const shown = new Set((trending.data?.videos ?? []).map((video) => video.id))
    const rest = (latest.data?.videos ?? []).filter((video) => !shown.has(video.id))
    return { fresh: rest.slice(0, 8), previews: (latest.data?.videos ?? []).filter((video) => video.previewSeconds > 0).slice(0, 4) }
  }, [trending.data, latest.data])

  const empty = trending.data !== null && trending.data.videos.length === 0

  return (
    <div className="space-y-10">
      <CategoryChips value={category} onChange={setCategory} />

      {category ? (
        filtered.data && filtered.data.videos.length === 0 ? (
          <EmptyState title="Nothing here yet" body="No videos in this topic yet. Try another one." />
        ) : (
          <VideoGrid videos={filtered.data?.videos ?? null} loading={filtered.loading && !filtered.data} />
        )
      ) : empty ? (
        <EmptyState
          title="No videos yet"
          body="Be the first to publish. Set a price per second and get paid as people watch."
          action={
            <Link to="/studio/upload" className="inline-flex min-h-11 items-center rounded-full bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-ink)]">
              Upload a video
            </Link>
          }
        />
      ) : (
        <>
          <section aria-labelledby="trending" className="space-y-4">
            <h2 id="trending" className="sr-only">
              Trending now
            </h2>
            <VideoGrid lead videos={trending.data?.videos ?? null} loading={trending.loading && !trending.data} />
          </section>

          {previews.length > 0 && (
            <section aria-labelledby="previews" className="space-y-4">
              <SectionHeader id="previews" title="Try before you pay" to="/explore" />
              <VideoGrid videos={previews} />
            </section>
          )}

          {fresh.length > 0 && (
            <section aria-labelledby="fresh" className="space-y-4">
              <SectionHeader id="fresh" title="Just uploaded" to="/explore?sort=new" />
              <VideoGrid videos={fresh} />
            </section>
          )}
        </>
      )}

      <section aria-label="How it works" className="grid gap-4 pt-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step.title} className="rise rounded-2xl bg-[#181818] p-5" style={{ ['--i' as string]: index }}>
            <div className="flex items-center justify-between">
              <step.icon className="size-5 text-[var(--accent)]" aria-hidden />
              <span className="mono text-xs tabular-nums text-[var(--subtle)]">0{index + 1}</span>
            </div>
            <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
            <p className="mt-1 text-pretty text-sm text-[var(--muted)]">{step.body}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
