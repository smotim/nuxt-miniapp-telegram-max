/**
 * The runtime's storage prefix (`runtime/client/storage.ts`). Repeated here
 * because the module may not import runtime code; a test keeps them equal.
 */
export const STORAGE_PREFIX = 'nuxt-miniapp:'

export interface EarlyDetectOptions {
  /** sessionStorage / localStorage key prefix, the same as the runtime's. */
  prefix: string
  /** Class prefix for <html>: `${classPrefix}telegram`, `${classPrefix}max`. */
  classPrefix: string
  /** Attribute for the color scheme on <html>, or empty to leave it alone. */
  attribute: string
}

/**
 * Runs as an inline script in <head>, before the page is drawn and before
 * hydration: marks <html> with the messenger, so markup rendered on the server
 * (always as the website) can differ by CSS without a flash, and restores the
 * last color scheme of the mini app. Captures the launch hash, which the
 * router drops on the first navigation. Without launch parameters it listens
 * for `hashchange`: iOS Telegram may set the hash after the page started
 * loading. Blocked storage ends it quietly — the plugin detects the client again.
 *
 * Stringified into every page: it must not reference anything outside itself,
 * and comments stay out of its body, or they ship too.
 */
export function earlyDetect(options: EarlyDetectOptions): void {
  try {
    const root = document.documentElement
    const capture = () => {
      const hash = location.hash.slice(1)
      const client = /(?:^|&)tgWebApp(?:Data|Platform)=/.test(hash)
        ? 'telegram'
        : /(?:^|&)WebAppData=/.test(hash) ? 'max' : null
      if (client) {
        sessionStorage.setItem(`${options.prefix}client`, client)
        sessionStorage.setItem(`${options.prefix}launch-hash`, hash)
      }
      return client || sessionStorage.getItem(`${options.prefix}client`)
    }

    const client = capture()
    if (client !== 'telegram' && client !== 'max') {
      addEventListener('hashchange', () => {
        const late = capture()
        if (late === 'telegram' || late === 'max') root.classList.add(options.classPrefix + late)
      })
      return
    }

    root.classList.add(options.classPrefix + client)
    if (options.attribute) {
      const scheme = localStorage.getItem(`${options.prefix}color-scheme`)
      if (scheme === 'light' || scheme === 'dark') root.setAttribute(options.attribute, scheme)
    }
  }
  catch {
    return
  }
}
