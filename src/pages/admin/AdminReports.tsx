import { useState } from 'react'
import { toast } from 'sonner'
import { REPORT_REASONS } from '@shared/constants'
import type { ReportItem } from '@shared/types'
import { Button, Chip, EmptyState, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { shortAddress, timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'

export function AdminReports() {
  const [status, setStatus] = useState<'open' | 'resolved'>('open')
  const { data, loading, reload } = useApi<{ reports: ReportItem[] }>(`admin/reports?status=${status}`)
  const [busy, setBusy] = useState<string | null>(null)

  const resolve = async (id: string, action: 'remove' | 'dismiss') => {
    setBusy(id)
    try {
      await api(`admin/reports/${id}/resolve`, { method: 'POST', body: { action } })
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not resolve')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        <Chip active={status === 'open'} onClick={() => setStatus('open')}>
          Open
        </Chip>
        <Chip active={status === 'resolved'} onClick={() => setStatus('resolved')}>
          Resolved
        </Chip>
      </div>
      {loading && !data ? (
        <Skeleton className="h-48" />
      ) : !data || data.reports.length === 0 ? (
        <EmptyState title={status === 'open' ? 'No open reports' : 'Nothing resolved yet'} />
      ) : (
        <ul className="space-y-3">
          {data.reports.map((report) => (
            <li key={report.id} className="glass space-y-3 rounded-3xl p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--subtle)]">
                <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-[var(--ink)]">
                  {REPORT_REASONS.find((reason) => reason.value === report.reason)?.label ?? report.reason}
                </span>
                <span>reported by {shortAddress(report.reporter)}</span>
                <span>· {timeAgo(report.createdAt)}</span>
              </div>
              {report.target.kind === 'video' ? (
                <p className="text-sm">
                  Video:{' '}
                  <Link to={`/watch/${report.target.id}`} className="font-semibold hover:underline">
                    {report.target.title}
                  </Link>{' '}
                  <span className="text-[var(--subtle)]">({report.target.status})</span>
                </p>
              ) : (
                <p className="text-pretty text-sm">
                  Comment by {shortAddress(report.target.author)}:{' '}
                  <span className="text-[var(--muted)]">"{report.target.body}"</span>
                </p>
              )}
              {report.details && <p className="text-pretty text-sm text-[var(--muted)]">{report.details}</p>}
              {report.status === 'open' ? (
                <div className="flex gap-2">
                  <Button variant="danger" loading={busy === report.id} onClick={() => void resolve(report.id, 'remove')} className="min-h-10">
                    Remove content
                  </Button>
                  <Button variant="secondary" loading={busy === report.id} onClick={() => void resolve(report.id, 'dismiss')} className="min-h-10">
                    Dismiss
                  </Button>
                </div>
              ) : (
                <p className="text-xs font-semibold text-[var(--muted)]">Resolved: {report.resolution}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
