import { useState } from 'react'
import { toast } from 'sonner'
import { ProfilePicture } from '@/components/creator/ProfilePicture'
import { Button, Panel, inputClass } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'

const USERNAME = /^[a-z0-9_]{3,24}$/

export function StudioSettings() {
  const { user, refresh } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)

  const usernameOk = USERNAME.test(username)
  const changed = username !== (user?.username ?? '') || displayName !== (user?.displayName ?? '') || bio !== (user?.bio ?? '')

  const save = async () => {
    if (!usernameOk) return
    setSaving(true)
    try {
      await api('users/me', { method: 'PATCH', body: { username, displayName: displayName.trim(), bio: bio.trim() } })
      await refresh()
      toast.success('Profile saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="max-w-xl space-y-3 !p-3.5">
      <ProfilePicture />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="username" className="mb-1 block text-sm font-medium">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={24}
            aria-invalid={!usernameOk}
            className={`${inputClass} mono`}
          />
          <p className={`mt-1 text-xs ${usernameOk ? 'text-[var(--subtle)]' : 'text-[var(--danger)]'}`}>3 to 24 characters: letters, numbers and underscores.</p>
        </div>
        <div>
          <label htmlFor="display" className="mb-1 block text-sm font-medium">
            Display name
          </label>
          <input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="bio" className="mb-1 flex items-center justify-between text-sm font-medium">
          About
          <span className="text-xs font-normal tabular-nums text-[var(--subtle)]">{bio.length}/280</span>
        </label>
        <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} className={inputClass} />
      </div>
      <Button loading={saving} disabled={!usernameOk || !changed} onClick={() => void save()}>
        Save profile
      </Button>
    </Panel>
  )
}
