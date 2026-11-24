import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/primitives'
import { api, putAvatar } from '@/lib/api'
import { useAuth } from '@/providers/AuthProvider'

const SIZE = 256

/** Crops the middle square of the picture and shrinks it, so what is uploaded is always small and square. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize pictures')
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not prepare the picture'))), 'image/jpeg', 0.9))
}

export function ProfilePicture() {
  const { user, refresh } = useAuth()
  const input = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)
  if (!user) return null
  const name = user.displayName ?? user.username

  const choose = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Choose an image file')
    setBusy(true)
    try {
      await putAvatar(await toSquareJpeg(file))
      await refresh()
      toast.success('Profile picture updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload the picture')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await api('users/me/avatar', { method: 'DELETE' })
      await refresh()
      toast.success('Profile picture removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the picture')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} size={72} accent username={user.username} version={user.avatarVersion} />
      <div className="min-w-0">
        <p className="text-sm font-medium">Profile picture</p>
        <p className="mt-0.5 text-xs text-[var(--subtle)]">Shown next to your videos and comments. It is cropped to a square.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} aria-label="Choose a profile picture" />
          <Button variant="secondary" shape="rect" loading={busy} onClick={() => input.current?.click()} className="min-h-10">
            <Camera className="size-4" aria-hidden /> {user.avatarVersion ? 'Change' : 'Upload'}
          </Button>
          {user.avatarVersion && (
            <Button variant="ghost" shape="rect" disabled={busy} onClick={() => void remove()} className="min-h-10">
              <Trash2 className="size-4" aria-hidden /> Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
