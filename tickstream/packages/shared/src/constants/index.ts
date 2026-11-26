/**
 * Length of one encrypted HLS segment for every video. A payment unlocks exactly one segment, so this is also how many
 * seconds each payment buys. Videos encoded with another length are re-encoded with the `videos:reencode` job;
 * until then they keep the length stored on them (`segment_seconds`) and are paid one segment at a time.
 */
export const SEGMENT_SECONDS = 3

/**
 * The playing block and the block after it are always paid. Opening a video pays the first block. As soon as a block
 * starts playing, the next one is paid, so the viewer is never more than one block away from unpaid video and never
 * watches video that is not paid for.
 */
export const PAY_BLOCK_SECONDS = 3

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
