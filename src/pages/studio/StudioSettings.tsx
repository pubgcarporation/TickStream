import { useState } from 'react'
import { toast } from 'sonner'
import { Button, Panel, inputClass } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'

export function StudioSettings() {
  const { user, refresh } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      await api('users/me', { method: 'PATCH', body: { username, displayName, bio } })
      await refresh()
      toast.success('Profile saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel className="max-w-xl space-y-4">
      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
          Username
        </label>
        <input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={24} className={`${inputClass} mono`} />
        <p className="mt-1.5 text-xs text-[var(--subtle)]">3 to 24 characters: letters, numbers and underscores.</p>
      </div>
      <div>
        <label htmlFor="display" className="mb-1.5 block text-sm font-medium">
          Display name
        </label>
        <input id="display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={inputClass} />
      </div>
      <div>
        <label htmlFor="bio" className="mb-1.5 block text-sm font-medium">
          About
        </label>
        <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={280} rows={3} className={inputClass} />
      </div>
      <Button loading={saving} onClick={() => void save()}>
        Save profile
      </Button>
    </Panel>
  )
}
