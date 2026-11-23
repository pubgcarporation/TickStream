import Hls, { type ErrorData, type FragChangedData } from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SessionInfo } from '@shared/types'
import { api, ApiError, apiUrl, getToken } from '@/lib/api'
import { createPaymentScheme } from '@/lib/spending-wallet'
import { endSessionKeepalive, isFundsError, payNextChunk, seekSession } from './payments'

export type Phase = 'idle' | 'starting' | 'playing' | 'needs-funds' | 'capped' | 'ended' | 'error'

export interface StartOptions {
  capMicro: number
  chunkSeconds: number
  startSecond?: number
}

export interface PlaybackView {
  phase: Phase
  message: string | null
  session: SessionInfo | null
  position: number
  playedSeconds: number
  paying: boolean
  paused: boolean
}

const TICK_MS = 1000
const HEARTBEAT_MS = 20_000
const MAX_RECOVERIES = 3

/**
 * Drives paid playback. The server decides what is unlocked; this hook only asks for the next chunk
 * when the viewer is about to run out of paid video, and never while paused.
 */
export function usePaidPlayback(videoId: string, owner: string | undefined) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const sessionRef = useRef<SessionInfo | null>(null)
  const fragRef = useRef<{ sn: number; start: number } | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const payingRef = useRef(false)
  const playedRef = useRef(0)
  const lastTimeRef = useRef(0)
  const recoveriesRef = useRef(0)
  const optionsRef = useRef<StartOptions | null>(null)

  const [view, setView] = useState<PlaybackView>({
    phase: 'idle',
    message: null,
    session: null,
    position: 0,
    playedSeconds: 0,
    paying: false,
    paused: true,
  })

  const patch = useCallback((changes: Partial<PlaybackView>) => {
    if (changes.phase) phaseRef.current = changes.phase
    if (changes.session) sessionRef.current = changes.session
    setView((current) => ({ ...current, ...changes }))
  }, [])

  const position = useCallback((): number => {
    const session = sessionRef.current
    const video = videoRef.current
    if (!session) return 0
    const frag = fragRef.current
    if (!frag || !video) return session.startSecond
    return frag.sn * session.segmentSeconds + Math.max(0, video.currentTime - frag.start)
  }, [])

  const teardownPlayer = useCallback(() => {
    hlsRef.current?.destroy()
    hlsRef.current = null
    fragRef.current = null
  }, [])

  const stopPlayback = useCallback((phase: Phase, message: string | null) => {
    videoRef.current?.pause()
    patch({ phase, message, paying: false })
  }, [patch])

  const loadPlaylist = useCallback(
    (session: SessionInfo) => {
      const video = videoRef.current
      if (!video) return
      teardownPlayer()
      if (!Hls.isSupported()) {
        patch({ phase: 'error', message: 'This browser cannot play encrypted streams. Try a recent Chrome, Edge, Firefox or Safari.' })
        return
      }
      const hls = new Hls({
        startPosition: 0,
        liveSyncDurationCount: 100,
        liveMaxLatencyDurationCount: Number.POSITIVE_INFINITY,
        maxBufferLength: 12,
        maxMaxBufferLength: 20,
        backBufferLength: 30,
        xhrSetup: (xhr) => {
          const token = getToken()
          if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        },
      })
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined)
      })
      hls.on(Hls.Events.FRAG_CHANGED, (_event, data: FragChangedData) => {
        fragRef.current = { sn: Number(data.frag.sn), start: data.frag.start }
      })
      hls.on(Hls.Events.ERROR, (_event, data: ErrorData) => {
        if (!data.fatal) return
        const code = data.response?.code
        if (code === 410 || code === 403) {
          stopPlayback('ended', 'This viewing session ended. Start again to keep watching.')
          return
        }
        if (recoveriesRef.current >= MAX_RECOVERIES) {
          stopPlayback('error', 'Playback stopped because the connection kept failing.')
          return
        }
        recoveriesRef.current += 1
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError()
        else hls.startLoad()
      })
      hls.loadSource(apiUrl(session.playlistUrl))
      hls.attachMedia(video)
      hlsRef.current = hls
      fragRef.current = null
      recoveriesRef.current = 0
    },
    [patch, stopPlayback, teardownPlayer],
  )

  const classify = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.code === 'cap_reached') {
        stopPlayback('capped', 'You reached the spending cap you set for this session.')
      } else if (isFundsError(error)) {
        stopPlayback('needs-funds', 'Your spending balance is too low for the next payment. Add funds to continue.')
      } else if (error instanceof ApiError && error.status === 410) {
        stopPlayback('ended', 'This viewing session ended. Start again to keep watching.')
      } else {
        const message = error instanceof Error ? error.message : 'Payment failed'
        stopPlayback('error', message)
      }
    },
    [stopPlayback],
  )

  /** Pays for the next chunk. Returns the updated session, or undefined if the payment did not go through. */
  const payNext = useCallback(async (): Promise<SessionInfo | undefined> => {
    const session = sessionRef.current
    if (!session || !owner || payingRef.current) return undefined
    payingRef.current = true
    patch({ paying: true })
    try {
      const result = await payNextChunk(session.id, createPaymentScheme(owner))
      patch({ session: result.session })
      return result.session
    } catch (error) {
      classify(error)
      return undefined
    } finally {
      payingRef.current = false
      setView((current) => ({ ...current, paying: false }))
    }
  }, [owner, patch, classify])

  const start = useCallback(
    async (options: StartOptions, payer: string) => {
      if (!owner) return
      optionsRef.current = options
      payingRef.current = false
      playedRef.current = 0
      lastTimeRef.current = 0
      patch({ phase: 'starting', message: null, playedSeconds: 0, position: options.startSecond ?? 0, paused: false })
      try {
        const created = await api<{ session: SessionInfo }>(`videos/${videoId}/sessions`, {
          method: 'POST',
          body: { payer, capMicro: options.capMicro, chunkSeconds: options.chunkSeconds, startSecond: options.startSecond ?? 0 },
        })
        patch({ session: created.session })
        const paid = await payNext()
        if (!paid) return
        patch({ phase: 'playing' })
        loadPlaylist(paid)
      } catch (error) {
        classify(error)
      }
    },
    [owner, videoId, patch, payNext, loadPlaylist, classify],
  )

  const resume = useCallback(async () => {
    const session = sessionRef.current
    if (!session || phaseRef.current === 'ended') return
    patch({ phase: 'playing', message: null })
    const next = await payNext()
    if (next) {
      if (!hlsRef.current) loadPlaylist(next)
      videoRef.current?.play().catch(() => undefined)
    }
  }, [patch, payNext, loadPlaylist])

  const seek = useCallback(
    async (second: number) => {
      const session = sessionRef.current
      const video = videoRef.current
      if (!session || !video || phaseRef.current !== 'playing') return
      if (second >= session.startSecond && second < session.authorizedEndSecond - 0.5) {
        const sn = Math.floor(second / session.segmentSeconds)
        const fragments = hlsRef.current?.levels[0]?.details?.fragments ?? []
        const frag = fragments.find((item) => Number(item.sn) === sn)
        if (frag) video.currentTime = frag.start + (second - sn * session.segmentSeconds)
        return
      }
      try {
        const moved = await seekSession(session.id, second)
        patch({ session: moved.session, position: second })
        const paid = moved.session.authorizedEndSecond > second ? moved.session : await payNext()
        if (paid) loadPlaylist(paid)
      } catch (error) {
        classify(error)
      }
    },
    [patch, payNext, loadPlaylist, classify],
  )

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video || phaseRef.current !== 'playing') return
    if (video.paused) video.play().catch(() => undefined)
    else video.pause()
  }, [])

  const end = useCallback(
    async (message: string | null = null) => {
      const session = sessionRef.current
      teardownPlayer()
      videoRef.current?.pause()
      if (session && phaseRef.current !== 'idle') {
        await api(`sessions/${session.id}`, { method: 'DELETE' }).catch(() => undefined)
      }
      sessionRef.current = null
      patch({ phase: 'idle', message, session: null, paying: false, position: 0 })
    },
    [patch, teardownPlayer],
  )

  // Once a second: count what actually played, update the position, and pay ahead only when needed.
  useEffect(() => {
    const timer = setInterval(() => {
      const session = sessionRef.current
      const video = videoRef.current
      if (!session || !video || phaseRef.current !== 'playing') return
      const delta = video.currentTime - lastTimeRef.current
      lastTimeRef.current = video.currentTime
      if (!video.paused && !video.seeking && delta > 0 && delta < 1.6) playedRef.current += delta
      const here = position()
      setView((current) => ({ ...current, position: here, playedSeconds: playedRef.current, paused: video.paused }))
      if (video.ended || (session.complete && here >= session.durationSeconds - 0.4)) {
        stopPlayback('ended', 'Finished. You were charged only for what played.')
        void api(`sessions/${session.id}`, { method: 'DELETE' }).catch(() => undefined)
        return
      }
      const lead = session.authorizedEndSecond - here
      if (!session.complete && !video.paused && !payingRef.current && lead <= Math.max(2, session.chunkSeconds * 0.5)) {
        void payNext()
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [position, payNext, stopPlayback])

  // Keep the session alive while the tab is open and notice if another tab took over.
  useEffect(() => {
    const timer = setInterval(() => {
      const session = sessionRef.current
      if (!session || phaseRef.current === 'idle' || phaseRef.current === 'ended') return
      api<{ session: SessionInfo }>(`sessions/${session.id}`).catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 410) {
          const reason = error.body.reason
          stopPlayback(
            'ended',
            reason === 'replaced'
              ? 'You started watching somewhere else, so this session was closed.'
              : 'This viewing session ended. Start again to keep watching.',
          )
        }
      })
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [stopPlayback])

  // Leaving the page ends the session so billing stops immediately.
  useEffect(() => {
    const onHide = () => {
      const session = sessionRef.current
      if (session && phaseRef.current !== 'idle' && phaseRef.current !== 'ended') {
        endSessionKeepalive(session.id, getToken())
      }
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [])

  return { videoRef, view, start, resume, seek, togglePlay, end, lastOptions: optionsRef }
}
