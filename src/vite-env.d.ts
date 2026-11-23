/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public app ID from the Privy dashboard. Optional: without it the app uses plain browser-wallet connection. */
  readonly VITE_PRIVY_APP_ID?: string
  /** Full address of the API, such as https://api.example.com. Leave unset to use /api on the same site. */
  readonly VITE_API_URL?: string
}
