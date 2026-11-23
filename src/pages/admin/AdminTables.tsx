import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { formatMicro, shortAddress, timeAgo } from '@/lib/format'

interface AdminPayment {
  id: string
  videoTitle: string
  payer: string
  creator: string
  amountMicro: number
  seconds: number
  status: 'pending' | 'settled' | 'failed'
  createdAt: string
}

interface AdminUser {
  address: string
  username: string
  createdAt: string
  videos: number
  earnedMicro: number
}

export function AdminPayments() {
  const { data, loading } = useApi<{ payments: AdminPayment[] }>('admin/payments')
  if (loading && !data) return <Skeleton className="h-48" />
  if (!data || data.payments.length === 0) return <EmptyState title="No payments yet" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-[var(--subtle)]">
            <th className="py-2 pr-4 font-medium">Video</th>
            <th className="py-2 pr-4 font-medium">Payer</th>
            <th className="py-2 pr-4 font-medium">Creator</th>
            <th className="py-2 pr-4 text-right font-medium">Seconds</th>
            <th className="py-2 pr-4 text-right font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.payments.map((payment) => (
            <tr key={payment.id}>
              <td className="max-w-[12rem] truncate py-2.5 pr-4 font-medium">{payment.videoTitle}</td>
              <td className="mono py-2.5 pr-4 text-xs">{shortAddress(payment.payer)}</td>
              <td className="mono py-2.5 pr-4 text-xs">{shortAddress(payment.creator)}</td>
              <td className="py-2.5 pr-4 text-right">{payment.seconds}</td>
              <td className="py-2 pr-4 text-right font-medium">{formatMicro(payment.amountMicro)}</td>
              <td className="py-2.5 pr-4">{payment.status}</td>
              <td className="py-2.5 text-[var(--subtle)]">{timeAgo(payment.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AdminUsers() {
  const { data, loading } = useApi<{ users: AdminUser[] }>('admin/users')
  if (loading && !data) return <Skeleton className="h-48" />
  if (!data || data.users.length === 0) return <EmptyState title="No users yet" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs text-[var(--subtle)]">
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Address</th>
            <th className="py-2 pr-4 text-right font-medium">Videos</th>
            <th className="py-2 pr-4 text-right font-medium">Earned</th>
            <th className="py-2 pr-4 font-medium">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.users.map((user) => (
            <tr key={user.address}>
              <td className="py-2.5 pr-4 font-medium">{user.username}</td>
              <td className="mono py-2.5 pr-4 text-xs">{shortAddress(user.address)}</td>
              <td className="py-2.5 pr-4 text-right">{user.videos}</td>
              <td className="py-2 pr-4 text-right font-medium">{formatMicro(user.earnedMicro)}</td>
              <td className="py-2.5 text-[var(--subtle)]">{timeAgo(user.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
