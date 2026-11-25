import { Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { COMMENT_MAX_LENGTH } from '@shared/constants'
import type { CommentItem } from '@shared/types'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/primitives'
import { api } from '@/lib/api'
import { compactNumber, timeAgoLong } from '@/lib/format'
import { Link } from '@/lib/router'
import { useAuth } from '@/providers/AuthProvider'

interface Page {
  total?: number
  comments: CommentItem[]
  nextBefore: string | null
}

/** Comments laid out like a video site's: a count, a one-line box that opens up when you click it, then a flat list. */
export function CommentsSection({ videoId }: { videoId: string }) {
  const { user, signIn } = useAuth()
  const [comments, setComments] = useState<CommentItem[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [nextBefore, setNextBefore] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [focused, setFocused] = useState(false)
  const [posting, setPosting] = useState(false)
  const box = useRef<HTMLTextAreaElement | null>(null)

  const load = useCallback(
    async (before?: string) => {
      const query = before ? `?before=${encodeURIComponent(before)}` : ''
      if (before) setLoadingMore(true)
      try {
        const page = await api<Page>(`videos/${videoId}/comments${query}`)
        setComments((list) => (before ? [...list, ...page.comments] : page.comments))
        if (typeof page.total === 'number') setTotal(page.total)
        setNextBefore(page.nextBefore)
        setFailed(null)
      } catch (error) {
        setFailed(error instanceof Error ? error.message : 'Could not load comments')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [videoId],
  )

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0)
    return () => clearTimeout(timer)
  }, [load])

  // The box grows with what is typed, up to a few lines.
  useEffect(() => {
    const element = box.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`
  }, [draft, focused])

  const cancel = () => {
    setDraft('')
    setFocused(false)
    box.current?.blur()
  }

  const post = async () => {
    const body = draft.trim()
    if (!body) return
    setPosting(true)
    try {
      const result = await api<{ comment: CommentItem }>(`videos/${videoId}/comments`, { method: 'POST', body: { body } })
      setComments((current) => [result.comment, ...current])
      setTotal((count) => (count === null ? count : count + 1))
      setDraft('')
      setFocused(false)
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
      setTotal((count) => (count === null ? count : Math.max(0, count - 1)))
      toast.success('Comment removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the comment')
    }
  }

  const me = user?.displayName ?? user?.username ?? 'You'
  const count = total ?? (nextBefore ? null : comments.length)

  return (
    <section aria-labelledby="comments-title" className="space-y-3">
      <h2 id="comments-title" className="text-base font-bold">
        {count === null ? 'Comments' : `${compactNumber(count)} ${count === 1 ? 'Comment' : 'Comments'}`}
      </h2>

      <div className="flex gap-3">
        {user ? <Avatar name={me} size={40} username={user.username} version={user.avatarVersion} /> : <Avatar name="?" size={40} />}
        <div className="min-w-0 flex-1">
          <textarea
            ref={box}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => {
              if (!user) {
                box.current?.blur()
                void signIn()
                return
              }
              setFocused(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') cancel()
              else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void post()
            }}
            maxLength={COMMENT_MAX_LENGTH}
            rows={1}
            placeholder={user ? 'Add a comment...' : 'Sign in to add a comment...'}
            aria-label="Add a comment"
            className="block w-full resize-none border-0 border-b border-[var(--border-strong)] bg-transparent pb-1 text-sm leading-5 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--ink)]"
          />
          {focused && (
            <div className="mt-2 flex items-center justify-end gap-2">
              {draft.length > COMMENT_MAX_LENGTH * 0.8 && (
                <span className="mr-auto text-xs tabular-nums text-[var(--subtle)]">
                  {draft.length}/{COMMENT_MAX_LENGTH}
                </span>
              )}
              <button type="button" onClick={cancel} className="h-9 rounded-full px-4 text-sm font-medium hover:bg-white/10">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void post()}
                disabled={!draft.trim() || posting}
                className="h-9 rounded-full bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-ink)] transition-colors hover:bg-[var(--accent-hover)] disabled:bg-white/10 disabled:text-[var(--subtle)]"
              >
                {posting ? 'Posting...' : 'Comment'}
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3" aria-label="Loading comments">
          <Skeleton className="h-10 w-full !rounded-lg" />
          <Skeleton className="h-10 w-5/6 !rounded-lg" />
        </div>
      ) : failed && comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Could not load comments.{' '}
          <button type="button" onClick={() => void load()} className="font-semibold text-[var(--accent)] hover:underline">
            Try again
          </button>
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">No comments yet. Be the first.</p>
      ) : (
        <ul className="space-y-3.5 pt-1">
          {comments.map((comment) => {
            const name = comment.author.displayName ?? comment.author.username
            return (
              <li key={comment.id} className="flex gap-3">
                <Link to={`/profile/${comment.author.username}`} aria-label={`${name}'s profile`} className="shrink-0">
                  <Avatar name={name} size={40} username={comment.author.username} version={comment.author.avatarVersion} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-[18px] text-[var(--muted)]">
                    <Link to={`/profile/${comment.author.username}`} className="font-medium text-[var(--ink)] hover:underline">
                      @{comment.author.username}
                    </Link>{' '}
                    {timeAgoLong(comment.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap break-words text-pretty text-sm leading-5">{comment.body}</p>
                </div>
                {comment.canRemove && (
                  <button
                    onClick={() => void remove(comment.id)}
                    aria-label="Remove comment"
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--subtle)] hover:bg-white/10 hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {nextBefore && (
        <button type="button" disabled={loadingMore} onClick={() => void load(nextBefore)} className="h-9 rounded-full px-4 text-sm font-medium text-[var(--accent)] hover:bg-white/10 disabled:opacity-50">
          {loadingMore ? 'Loading...' : 'Show more comments'}
        </button>
      )}
    </section>
  )
}
