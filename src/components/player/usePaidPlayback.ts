import Hls, { type ErrorData, type FragChangedData } from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { PAID_AHEAD_SEGMENTS } from '@shared/constants'
import type { SessionInfo } from '@shared/types'
import { api, ApiError, apiUrl, getToken } from '@/lib/api'
import { createPaymentScheme } from '@/lib/spending-wallet'
import { endSessionKeepalive, forgetNextPayment, isFundsError, payNextChunk, seekSession } from './payments'

export type Phase = 'idle' | 'starting' | 'playing' | 'needs-funds' | 'capped' | 'ended' | 'error'

export interface StartOptions {
  capMicro: number
  startSecond?: number
}

export interface PlaybackView {
  phase: Phase
  message: string | null
  session: SessionInfo | null
  position: number
  playedSeconds: number
  /** Seconds of the creator's free preview this session started with. They are never billed. */
  freeSeconds: number
  paying: boolean
  paused: boolean
}

const TICK_MS = 1000
/** How often the player checks whether a new second has started and needs paying for. Short, so a payment goes out right at the boundary. */
const PAY_CHECK_MS = 100

/**
 * True when the viewer has not yet paid for the second after the one that is playing. Playback starts with the first
 * second and the next one paid. When the second after that begins, the one following it is paid, and so on, so exactly
 * one second is always paid ahead of the one being watched.
 */
function owesPayment(session: SessionInfo, here: number): boolean {
  if (session.complete) return false
  const seg = session.segmentSeconds
  const wantedEnd = (Math.floor(here / seg) + 1 + PAID_AHEAD_SEGMENTS) * seg
  return session.authorizedEndSecond < wantedEnd - 1e-6
}

/** Asks the player to fetch the playlist again now, so a second that was just paid for is known without waiting for the next poll. */
function refreshPlaylist(hls: Hls | null): void {
  const controller = (hls as unknown as { levelController?: { startLoad?: () => void } } | null)?.levelController
  controller?.startLoad?.()
}
const HEARTBEAT_MS = 20_000
/** Waits (ms) before each retry of a payment that failed for a reason that usually clears up on its own. */
const PAYMENT_RETRY_DELAYS = [350, 900, 1800]

/** A dropped connection, a Gateway hiccup (502) or a payment already in progress (429 busy) is worth another try. */
function isTransient(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return error.status === 0 || error.status === 502 || error.status === 503 || error.status === 504 || (error.status === 429 && error.code === 'busy')
}
const MAX_RECOVERIES = 3

/**
 * Drives paid playback. The server decides what is unlocked; this hook only pays for the next second
 * when a new second starts, and never while paused.
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
    freeSeconds: 0,
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
        // Only paid seconds are ever available, so there is nothing to buffer far ahead.
        maxBufferLength: 4,
        maxMaxBufferLength: 6,
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
        stopPlayback('capped', 'You have used the spending balance this session started with. Add money, then continue.')
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
      for (let attempt = 0; ; attempt += 1) {
        try {
          const result = await payNextChunk(session.id, createPaymentScheme(owner))
          patch({ session: result.session })
          refreshPlaylist(hlsRef.current)
          return result.session
        } catch (error) {
          const delay = PAYMENT_RETRY_DELAYS[attempt]
          if (delay === undefined || !isTransient(error)) throw error
          // A short pause and another try keeps one bad moment on the network from ending the viewing session.
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    } catch (error) {
      classify(error)
      return undefined
    } finally {
      payingRef.current = false
      setView((current) => ({ ...current, paying: false }))
    }
  }, [owner, patch, classify])

  /** Pays until the second being played and the one after it are covered. Returns the session, or undefined if a payment failed. */
  const topUp = useCallback(
    async (from: SessionInfo, here: number): Promise<SessionInfo | undefined> => {
      let current = from
      // Two payments at most are ever missing: the second being played and the one after it.
      for (let step = 0; step < 1 + PAID_AHEAD_SEGMENTS && owesPayment(current, here); step += 1) {
        const next = await payNext()
        if (!next) return undefined
        current = next
      }
      return current
    },
    [payNext],
  )

  const start = useCallback(
    async (options: StartOptions, payer: string) => {
      if (!owner) return
      optionsRef.current = options
      payingRef.current = false
      if (sessionRef.current) forgetNextPayment(sessionRef.current.id)
      playedRef.current = 0
      lastTimeRef.current = 0
      patch({ phase: 'starting', message: null, playedSeconds: 0, freeSeconds: 0, position: options.startSecond ?? 0, paused: false })
      try {
        const created = await api<{ session: SessionInfo }>(`videos/${videoId}/sessions`, {
          method: 'POST',
          body: { payer, capMicro: options.capMicro, startSecond: options.startSecond ?? 0 },
        })
        patch({ session: created.session, freeSeconds: created.session.authorizedSeconds })
        // A creator's free preview is already unlocked. Otherwise the first second and the one after it are paid
        // before playback starts.
        const paid = await topUp(created.session, options.startSecond ?? 0)
        if (!paid) return
        patch({ phase: 'playing' })
        loadPlaylist(paid)
      } catch (error) {
        classify(error)
      }
    },
    [owner, videoId, patch, topUp, loadPlaylist, classify],
  )

  const resume = useCallback(async () => {
    const session = sessionRef.current
    if (!session || phaseRef.current === 'ended') return
    patch({ phase: 'playing', message: null })
    // Pausing never costs anything, and resuming only pays when the paid video is running low, so repeated
    // pause and resume cannot pile up payments.
    const next = await topUp(session, position())
    if (next) {
      if (!hlsRef.current) loadPlaylist(next)
      videoRef.current?.play().catch(() => undefined)
    }
  }, [patch, topUp, loadPlaylist, position])

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
        const paid = await topUp(moved.session, second)
        if (paid) loadPlaylist(paid)
      } catch (error) {
        classify(error)
      }
    },
    [patch, topUp, loadPlaylist, classify],
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
        await api(`sessions/${session.id}`, { method: 'DELETE', body: { second: Math.floor(position()) } }).catch(() => undefined)
      }
      sessionRef.current = null
      patch({ phase: 'idle', message, session: null, paying: false, position: 0, freeSeconds: 0 })
    },
    [patch, teardownPlayer, position],
  )

  // Once a second: count what actually played and update the position.
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
        // The last fraction of a second never gets a tick of its own, so count it here. Then the whole video that
        // was paid for shows as watched, and nothing is left over as paid ahead.
        playedRef.current += Math.max(0, session.durationSeconds - here)
        setView((current) => ({ ...current, playedSeconds: playedRef.current, position: session.durationSeconds }))
        stopPlayback('ended', 'Finished watching. Nothing more will be charged.')
        // A finished video starts from the beginning next time, not from its last second.
        void api(`sessions/${session.id}`, { method: 'DELETE', body: { second: 0 } }).catch(() => undefined)
        return
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [position, stopPlayback])

  // Several times a second: when a new second has started, pay for the one after the next. Never while paused.
  useEffect(() => {
    const timer = setInterval(() => {
      const session = sessionRef.current
      const video = videoRef.current
      if (!session || !video || phaseRef.current !== 'playing' || video.paused || video.seeking || payingRef.current) return
      if (owesPayment(session, position())) void payNext()
    }, PAY_CHECK_MS)
    return () => clearInterval(timer)
  }, [position, payNext])

  // Keep the session alive while the tab is open and notice if another tab took over.
  useEffect(() => {
    const timer = setInterval(() => {
      const session = sessionRef.current
      if (!session || phaseRef.current === 'idle' || phaseRef.current === 'ended') return
      // The heartbeat also saves where the viewer is, so they can pick up from the same spot later.
      api<{ session: SessionInfo }>(`sessions/${session.id}/position`, { method: 'PUT', body: { second: Math.floor(position()) } }).catch((error: unknown) => {
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
  }, [stopPlayback, position])

  // Leaving the page ends the session so billing stops immediately.
  useEffect(() => {
    const onHide = () => {
      const session = sessionRef.current
      if (session && phaseRef.current !== 'idle' && phaseRef.current !== 'ended') {
        endSessionKeepalive(session.id, getToken(), position())
      }
    }
    window.addEventListener('pagehide', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      onHide()
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [position])

  return { videoRef, view, start, resume, seek, togglePlay, end, lastOptions: optionsRef }
}
