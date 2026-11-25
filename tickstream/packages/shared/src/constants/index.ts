/**
 * Length of one encrypted HLS segment for newly encoded videos. A payment unlocks exactly one segment, so this is also
 * how many seconds each payment buys. Videos encoded earlier keep the length stored on them (`segment_seconds`).
 */
export const SEGMENT_SECONDS = 1

/**
 * Segments paid ahead of the one that is playing. With 1 the viewer has paid for the second being played and for the
 * next one, and each time a new second starts the one after it is paid.
 */
export const PAID_AHEAD_SEGMENTS = 1

/** Most segments one payment may buy. A slow connection buys several at once so payments keep up with playback. */
export const MAX_PAYMENT_SEGMENTS = 6

/** Price per second, in USDC base units (6 decimals). 100 units is 0.0001 USDC per second. */
export const MIN_PRICE_PER_SECOND = 1
export const MAX_PRICE_PER_SECOND = 100_000
export const DEFAULT_PRICE_PER_SECOND = 200

/** Tips, in USDC base units (6 decimals): 0.01 to 100 USDC. */
export const MIN_TIP_MICRO = 10_000
export const MAX_TIP_MICRO = 100_000_000
export const MAX_TIP_MESSAGE_LENGTH = 140

export const CATEGORIES = [
  { slug: 'music', label: 'Music' },
  { slug: 'learning', label: 'Learning' },
  { slug: 'gaming', label: 'Gaming' },
  { slug: 'film', label: 'Film' },
  { slug: 'tech', label: 'Tech' },
  { slug: 'lifestyle', label: 'Lifestyle' },
  { slug: 'other', label: 'Other' },
] as const

export type CategorySlug = (typeof CATEGORIES)[number]['slug']

export const CATEGORY_SLUGS: readonly string[] = CATEGORIES.map((c) => c.slug)

/** A session with no playlist, key or segment request for this long is ended. */
export const SESSION_IDLE_SECONDS = 90

export const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
export const AUTH_NONCE_TTL_SECONDS = 60 * 5

export const COMMENT_MAX_LENGTH = 500

export const MAX_PREVIEW_SECONDS = 60
