import type { AdminOverview as Overview } from '@shared/types'
import { StatCard } from '@/components/creator/EarningsChart'
import { ErrorState, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { formatMicro } from '@/lib/format'

export function AdminOverview() {
  const { data, loading, error, reload } = useApi<{ overview: Overview }>('admin/overview')
  if (loading && !data) return <Skeleton className="h-48" />
  if (!data) return <ErrorState title="Could not load the overview" message={error?.message} onRetry={reload} />
  const o = data.overview
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard label="Users" value={String(o.users)} />
      <StatCard label="Videos" value={String(o.videos)} hint={`${o.removedVideos} removed`} />
      <StatCard label="Sessions, 24h" value={String(o.sessions24h)} />
      <StatCard label="Volume, all time" value={formatMicro(o.volumeTotalMicro)} unit="USDC" />
      <StatCard label="Volume, 24h" value={formatMicro(o.volume24hMicro)} unit="USDC" />
    </div>
  )
}
