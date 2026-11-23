import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAccount, useDisconnect, useSignMessage } from 'wagmi'
import { toast } from 'sonner'
import type { UserProfile } from '@shared/types'
import { api, getToken, onTokenChange, setToken } from '@/lib/api'

interface AuthState {
  user: UserProfile | null
  /** True once we know whether a stored token is still valid. */
  ready: boolean
  signingIn: boolean
  signIn: () => Promise<boolean>
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
  const { disconnect } = useDisconnect()
  const { signMessageAsync } = useSignMessage()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [ready, setReady] = useState(false)
  const [signingIn, setSigningIn] = useState(false)

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      setReady(true)
      return
    }
    try {
      const result = await api<{ user: UserProfile }>('auth/me')
      setUser(result.user)
    } catch {
      setUser(null)
    } finally {
      setReady(true)
    }
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
      const result = await api<{ token: string; user: UserProfile }>('auth/verify', {
        method: 'POST',
        body: { address, signature },
      })
      setToken(result.token)
      setUser(result.user)
      return true
    } catch (error) {
      if (!isRejection(error)) toast.error(error instanceof Error ? error.message : 'Could not sign in')
      return false
    } finally {
      setSigningIn(false)
    }
  }, [address, signMessageAsync])

  const signOut = useCallback(async () => {
    try {
      await api('auth/logout', { method: 'POST' })
    } catch {
      // the token is dropped locally either way
    }
    setToken(null)
    disconnect()
  }, [disconnect])

  const value = useMemo(
    () => ({ user, ready, signingIn, signIn, signOut, refresh }),
    [user, ready, signingIn, signIn, signOut, refresh],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
