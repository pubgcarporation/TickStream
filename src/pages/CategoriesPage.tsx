import { CATEGORIES } from '@shared/constants'
import { useApi } from '@/hooks/useApi'
import { Link } from '@/lib/router'

export function CategoriesPage() {
  const { data } = useApi<{ counts: Record<string, number> }>('categories')
  return (
    <div className="space-y-8">
      <h1 className="display text-4xl font-bold">Categories</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => (
          <li key={category.slug}>
            <Link
              to={`/explore?category=${category.slug}`}
              className="glass flex min-h-28 flex-col justify-between rounded-2xl p-5 transition-colors hover:bg-white/10"
            >
              <span className="display text-2xl font-semibold">{category.label}</span>
              <span className="text-sm tabular-nums text-[var(--muted)]">
                {data ? `${data.counts[category.slug] ?? 0} videos` : '...'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
