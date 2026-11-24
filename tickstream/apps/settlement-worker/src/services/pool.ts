/**
 * Runs `task` over `items` with at most `limit` in flight. Stops handing out work once `shouldStop` is true.
 * Returns how many items were started (always a prefix of `items`).
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
  shouldStop: () => boolean = () => false,
): Promise<number> {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!shouldStop()) {
      if (next >= items.length) return
      const index = next++
      await task(items[index])
    }
  })
  await Promise.all(lanes)
  return next
}
