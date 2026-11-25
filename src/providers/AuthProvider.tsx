import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { toast } from 'sonner'
import type { UserProfile } from '@shared/types'
import { useWalletDisconnect } from '@/hooks/useWalletDisconnect'
import { api, ApiError, getToken, onTokenChange, setToken } from '@/lib/api'

interface AuthState {
  user: UserProfile | null
  isAdmin: boolean
  /** True once we know whether a stored token is still valid. */
  ready: boolean
  signingIn: boolean
  signIn: () => Promise<boolean>
  /** Remember that the person wants to sign in, so the signature is requested as soon as a wallet connects. */
  requestSignIn: () => void
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function isRejection(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  return message.includes('user rejected') || message.includes('denied')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount()
  const disconnect = useWalletDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const wantSignIn = useRef(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setIsAdmin(false)
      setReady(true)
      return
    }
    // A slow or briefly unreachable server is not a sign-out. Only a refused token (401, which also drops it) is.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await api<{ user: UserProfile; isAdmin: boolean }>('auth/me')
        setUser(result.user)
        setIsAdmin(result.isAdmin)
        break
      } catch (error) {
        const refused = error instanceof ApiError && error.status >= 400 && error.status < 500
        if (refused || attempt === 2) {
          setUser(null)
          setIsAdmin(false)
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }
    setReady(true)
  }, [])

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0)
    const unsubscribe = onTokenChange(() => void refresh())
    return () => {
      clearTimeout(first)
      unsubscribe()
    }
  }, [refresh])

  // A session belongs to one wallet. If the connected wallet changes, the old sign-in no longer applies.
  useEffect(() => {
    if (user && isConnected && address && user.address !== address.toLowerCase()) setToken(null)
  }, [user, isConnected, address])

  const signIn = useCallback(async () => {
    if (!address) return false
    setSigningIn(true)
    try {
      const { message } = await api<{ message: string }>('auth/nonce', { method: 'POST', body: { address } })
      const signature = await signMessageAsync({ message })
      const result = await api<{ token: string; user: UserProfile; isAdmin: boolean }>('auth/verify', {
        method: 'POST',
        body: { address, signature },
      })
      setToken(result.token)
      setUser(result.user)
      setIsAdmin(result.isAdmin)
      toast.success('Signed in')
      return true
    } catch (error) {
      if (!isRejection(error)) toast.error(error instanceof Error ? error.message : 'Could not sign in')
      return false
    } finally {
      setSigningIn(false)
    }
  }, [address, signMessageAsync])

  const requestSignIn = useCallback(() => {
    wantSignIn.current = true
  }, [])

  useEffect(() => {
    if (!wantSignIn.current || !isConnected || !address || signingIn) return
    wantSignIn.current = false
    if (user) return
    const timer = setTimeout(() => void signIn(), 0)
    return () => clearTimeout(timer)
  }, [isConnected, address, signingIn, user, signIn])

  const signOut = useCallback(async () => {
    try {
      await api('auth/logout', { method: 'POST' })
    } catch {
      // the token is dropped locally either way
    }
    setToken(null)
    disconnect()
    toast('Signed out')
  }, [disconnect])

  const value = useMemo(
    () => ({ user, isAdmin, ready, signingIn, signIn, requestSignIn, signOut, refresh }),
    [user, isAdmin, ready, signingIn, signIn, requestSignIn, signOut, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
