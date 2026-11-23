/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public app ID from the Privy dashboard. Optional: without it the app uses plain browser-wallet connection. */
  readonly VITE_PRIVY_APP_ID?: string
}
