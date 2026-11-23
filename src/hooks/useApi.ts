import { useCallback, useEffect, useRef, useState } from 'react'
import { api, ApiError } from '@/lib/api'

interface QueryState<T> {
  data: T | null
  error: ApiError | Error | null
  loading: boolean
  reload: () => void
}

/** Loads `path` and reloads when it changes. Pass null to stay idle (for example while signed out). */
export function useApi<T>(path: string | null): QueryState<T> {
  // Data is remembered with the path it came from, so a new path never shows the previous page's data.
  const [loaded, setLoaded] = useState<{ path: string; data: T } | null>(null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [tick, setTick] = useState(0)
  const latest = useRef(0)

  useEffect(() => {
    if (path === null) return
    const id = ++latest.current
    const run = async () => {
      setLoading(true)
      try {
        const result = await api<T>(path)
        if (id !== latest.current) return
        setLoaded({ path, data: result })
        setError(null)
      } catch (caught) {
        if (id !== latest.current) return
        setError(caught instanceof Error ? caught : new Error('Request failed'))
      } finally {
        if (id === latest.current) setLoading(false)
      }
    }
    void run()
  }, [path, tick])

  const reload = useCallback(() => setTick((value) => value + 1), [])
  const data = path !== null && loaded?.path === path ? loaded.data : null
  return { data, error, loading: path === null ? false : loading, reload }
}
