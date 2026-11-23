import { CATEGORIES } from '@shared/constants'
import { useApi } from '@/hooks/useApi'
import { Link } from '@/lib/router'

export function CategoriesPage() {
  const { data } = useApi<{ counts: Record<string, number> }>('categories')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Categories</h1>
      <ul className="grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((category) => (
          <li key={category.slug} className="border-b border-[var(--border)]">
            <Link to={`/explore?category=${category.slug}`} className="flex min-h-12 items-center justify-between gap-4 py-2 transition-colors hover:text-[var(--accent)]">
              <span className="font-medium">{category.label}</span>
              <span className="text-sm tabular-nums text-[var(--subtle)]">{data ? `${data.counts[category.slug] ?? 0} videos` : '...'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
