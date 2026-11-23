import { Check, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { FollowState } from '@shared/types'
import { Button } from '@/components/ui/primitives'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'

export function FollowButton({ username, creatorAddress }: { username: string; creatorAddress: string }) {
  const { user, signIn } = useAuth()
  const { data, reload } = useApi<FollowState>(`creators/${encodeURIComponent(username)}/follow`)
  const [busy, setBusy] = useState(false)
  const isSelf = user?.address === creatorAddress

  if (isSelf) return null

  const toggle = async () => {
    if (!user) {
      await signIn()
      return
    }
    setBusy(true)
    try {
      await api(`creators/${encodeURIComponent(username)}/follow`, { method: data?.following ? 'DELETE' : 'PUT' })
      reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  const following = data?.following ?? false
  return (
    <Button variant={following ? 'secondary' : 'primary'} onClick={() => void toggle()} loading={busy} className="min-h-10 px-4">
      {following ? <Check className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
      {following ? 'Following' : 'Follow'}
      {data && <span className="tabular-nums opacity-70">· {data.followers}</span>}
    </Button>
  )
}
