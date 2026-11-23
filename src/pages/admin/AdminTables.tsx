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
    <div className="glass overflow-x-auto rounded-2xl p-2">
      <table className="w-full min-w-[640px] text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--subtle)]">
            <th className="p-3 font-semibold">Video</th>
            <th className="p-3 font-semibold">Payer</th>
            <th className="p-3 font-semibold">Creator</th>
            <th className="p-3 text-right font-semibold">Seconds</th>
            <th className="p-3 text-right font-semibold">Amount</th>
            <th className="p-3 font-semibold">Status</th>
            <th className="p-3 font-semibold">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.payments.map((payment) => (
            <tr key={payment.id}>
              <td className="max-w-[12rem] truncate p-3 font-medium">{payment.videoTitle}</td>
              <td className="mono p-3 text-xs">{shortAddress(payment.payer)}</td>
              <td className="mono p-3 text-xs">{shortAddress(payment.creator)}</td>
              <td className="p-3 text-right">{payment.seconds}</td>
              <td className="p-3 text-right font-semibold">{formatMicro(payment.amountMicro)}</td>
              <td className="p-3">{payment.status}</td>
              <td className="p-3 text-[var(--subtle)]">{timeAgo(payment.createdAt)}</td>
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
    <div className="glass overflow-x-auto rounded-2xl p-2">
      <table className="w-full min-w-[520px] text-sm tabular-nums">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--subtle)]">
            <th className="p-3 font-semibold">User</th>
            <th className="p-3 font-semibold">Address</th>
            <th className="p-3 text-right font-semibold">Videos</th>
            <th className="p-3 text-right font-semibold">Earned</th>
            <th className="p-3 font-semibold">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {data.users.map((user) => (
            <tr key={user.address}>
              <td className="p-3 font-medium">{user.username}</td>
              <td className="mono p-3 text-xs">{shortAddress(user.address)}</td>
              <td className="p-3 text-right">{user.videos}</td>
              <td className="p-3 text-right font-semibold">{formatMicro(user.earnedMicro)}</td>
              <td className="p-3 text-[var(--subtle)]">{timeAgo(user.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
