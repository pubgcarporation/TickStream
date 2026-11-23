/**
 * Privy login is optional. With VITE_PRIVY_APP_ID set, people can sign in with email, Google or an existing wallet and
 * get an embedded wallet. Without it, the app falls back to plain browser-wallet connection.
 */
const raw = import.meta.env.VITE_PRIVY_APP_ID

export const PRIVY_APP_ID = raw && raw.trim().length > 0 ? raw.trim() : undefined
export const privyEnabled = PRIVY_APP_ID !== undefined
