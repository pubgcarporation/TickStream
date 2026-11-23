/** Length of one encrypted HLS segment. Billing is per second, authorized per chunk of whole segments. */
export const SEGMENT_SECONDS = 2

/** Seconds of video one payment unlocks. The viewer picks one of these. */
export const CHUNK_SECONDS_OPTIONS = [6, 10, 20, 30] as const
export const DEFAULT_CHUNK_SECONDS = 10

/** Price per second, in USDC base units (6 decimals). 100 units is 0.0001 USDC per second. */
export const MIN_PRICE_PER_SECOND = 1
export const MAX_PRICE_PER_SECOND = 100_000
export const DEFAULT_PRICE_PER_SECOND = 200

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

/** Segments a viewer may fetch beyond the highest one already served, to keep a short buffer only. */
export const SEGMENT_LOOKAHEAD = 4

export const AUTH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7
export const AUTH_NONCE_TTL_SECONDS = 60 * 5

export const REPORT_REASONS = [
  { value: 'copyright', label: 'Copyright' },
  { value: 'misleading', label: 'Misleading or scam' },
  { value: 'abuse', label: 'Hate or abuse' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'other', label: 'Something else' },
] as const

export const COMMENT_MAX_LENGTH = 500

export const MAX_PREVIEW_SECONDS = 60
