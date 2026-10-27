/**
 * Storage that never throws: private windows, blocked site data and some
 * messenger webviews throw on access instead of returning null.
 */
export const STORAGE_PREFIX = 'nuxt-miniapp:'

export function sessionGet(key: string): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key)
  }
  catch {
    return null
  }
}

export function sessionSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, value)
  }
  catch {
    // Nothing to do: the value lives for this page only.
  }
}

/** Read back only by the inline script of `earlyDetect`. */
export function localSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, value)
  }
  catch {
    // Nothing to do: the next launch starts without it.
  }
}
