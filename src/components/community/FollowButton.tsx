import { Check } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { FollowState } from '@shared/types'
import { useApi } from '@/hooks/useApi'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'

/** Follower count and whether the signed-in viewer follows this creator. Shared by the button and the channel row. */
export function useFollowState(username: string | null) {
  const { user } = useAuth()
  return useApi<FollowState>(username ? `creators/${encodeURIComponent(username)}/follow?as=${user?.address ?? 'guest'}` : null)
}

/** A pill like a video site's subscribe button: light when you can follow, grey with a check once you do. */
export function FollowButton({
  username,
  creatorAddress,
  state,
  onChanged,
}: {
  username: string
  creatorAddress: string
  state: FollowState | null
  onChanged: () => void
}) {
  const { user, signIn } = useAuth()
  const [busy, setBusy] = useState(false)
  if (user?.address === creatorAddress) return null

  const following = state?.following ?? false
  const toggle = async () => {
    if (!user) {
      await signIn()
      return
    }
    setBusy(true)
    try {
      await api(`creators/${encodeURIComponent(username)}/follow`, { method: following ? 'DELETE' : 'PUT' })
      toast.success(following ? `Unfollowed ${username}` : `Following ${username}`)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={following}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60 ${
        following ? 'bg-white/10 text-[var(--ink)] hover:bg-white/15' : 'bg-[#f1f1f1] text-[#0f0f0f] hover:bg-white'
      }`}
    >
      {following && <Check className="size-4" aria-hidden />}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
