import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { COMMENT_MAX_LENGTH } from '@shared/constants'
import type { CommentItem } from '@shared/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button, inputClass } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { timeAgo } from '@/lib/format'
import { Link } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'

interface Page {
  comments: CommentItem[]
  nextBefore: string | null
}

export function CommentsSection({ videoId }: { videoId: string }) {
  const { user, signIn, signingIn } = useAuth()
  const [comments, setComments] = useState<CommentItem[]>([])
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  const load = useCallback(
    async (before?: string) => {
      const query = before ? `?before=${encodeURIComponent(before)}` : ''
      try {
        const page = await api<Page>(`videos/${videoId}/comments${query}`)
        setComments((current) => (before ? [...current, ...page.comments] : page.comments))
        setNextBefore(page.nextBefore)
      } catch {
        // an empty list is shown when comments cannot load
      } finally {
        setLoading(false)
      }
    },
    [videoId],
  )

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load, user?.address])

  const post = async () => {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    try {
      const result = await api<{ comment: CommentItem }>(`videos/${videoId}/comments`, { method: 'POST', body: { body } })
      setComments((current) => [result.comment, ...current])
      setDraft('')
      toast.success('Comment posted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post your comment')
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    try {
      await api(`comments/${id}`, { method: 'DELETE' })
      setComments((current) => current.filter((comment) => comment.id !== id))
      toast.success('Comment removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the comment')
    }
  }

  return (
    <section aria-labelledby="comments-title" className="space-y-5">
      <h2 id="comments-title" className="text-base font-semibold">
        Comments
      </h2>
      {user ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={COMMENT_MAX_LENGTH}
            rows={2}
            placeholder="Add a comment"
            aria-label="Add a comment"
            className={inputClass}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs tabular-nums text-[var(--subtle)]">
              {draft.length}/{COMMENT_MAX_LENGTH}
            </span>
            <Button loading={posting} disabled={!draft.trim()} onClick={() => void post()} className="min-h-10">
              Post
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" loading={signingIn} onClick={() => void signIn()}>
          Sign in to comment
        </Button>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={comment.author.displayName ?? comment.author.username} size={36} username={comment.author.username} version={comment.author.avatarVersion} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--subtle)]">
                  <Link to={`/profile/${comment.author.username}`} className="font-semibold text-[var(--ink)] hover:underline">
                    {comment.author.displayName ?? comment.author.username}
                  </Link>{' '}
                  · {timeAgo(comment.createdAt)}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-pretty text-sm">{comment.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {comment.canRemove && (
                  <button
                    onClick={() => void remove(comment.id)}
                    aria-label="Remove comment"
                    className="flex size-9 items-center justify-center rounded-full text-[var(--subtle)] hover:bg-white/10 hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {nextBefore && (
        <Button variant="ghost" onClick={() => void load(nextBefore)}>
          Show more
        </Button>
      )}
    </section>
  )
}
