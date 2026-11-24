import { Clapperboard, Cpu, GraduationCap, Gamepad2, Music, Shapes, Sparkles, type LucideIcon } from 'lucide-react'
import { CATEGORIES } from '@shared/constants'
import { PageHeader } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { Link } from '@/lib/router'

const ICONS: Record<string, LucideIcon> = {
  music: Music,
  learning: GraduationCap,
  gaming: Gamepad2,
  film: Clapperboard,
  tech: Cpu,
  lifestyle: Sparkles,
  other: Shapes,
}

export function CategoriesPage() {
  const { data, error } = useApi<{ counts: Record<string, number> }>('categories')
  return (
    <div className="space-y-4">
      <PageHeader title="Categories" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {CATEGORIES.map((category, index) => {
          const Icon = ICONS[category.slug] ?? Shapes
          const count = data?.counts[category.slug] ?? 0
          return (
            <li key={category.slug} className="rise" style={{ ['--i' as string]: index }}>
              <Link
                to={`/explore?category=${category.slug}`}
                className="group flex min-h-20 items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-white/25 hover:bg-[var(--surface-strong)]"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-[var(--accent)] transition-colors group-hover:bg-[var(--accent)]/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{category.label}</span>
                  <span className="block text-sm tabular-nums text-[var(--subtle)]">
                    {data ? `${count} ${count === 1 ? 'video' : 'videos'}` : error ? '' : '...'}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
