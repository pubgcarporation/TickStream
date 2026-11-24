/**
 * localStorage that never throws. Browsers block it in private windows and in some embedded frames, and a thrown
 * error there would blank the whole page. When it is blocked, values live in memory for the tab instead.
 */
const memory = new Map<string, string>()

export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memory.get(key) ?? null
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value)
    } catch {
      memory.set(key, value)
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key)
    } catch {
      memory.delete(key)
    }
  },
}
