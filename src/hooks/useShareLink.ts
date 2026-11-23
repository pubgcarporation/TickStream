import { useEffect, useState } from 'react'
import { buildShareLink } from '@/lib/share'

/** Resolves a shareable link for an in-app path once, so copy buttons can stay synchronous. */
export function useShareLink(path: string): string | null {
  const [state, setState] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    void buildShareLink(path).then((url) => {
      if (!cancelled) setState({ path, url })
    })
    return () => {
      cancelled = true
    }
  }, [path])
  return state?.path === path ? state.url : null
}
