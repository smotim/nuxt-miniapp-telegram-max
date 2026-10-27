import type { ColorScheme } from '../../types'

/** Whether `url` is an https link to one of `hosts`. */
export function isLinkOf(url: string, hosts: readonly string[]): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && hosts.includes(hostname)
  }
  catch {
    return false
  }
}

/** A native call that answers through a callback; null when the method throws right away. */
export function callWithCallback<T>(call: (resolve: (value: T) => void) => void): Promise<T> | null {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  try {
    call(resolve)
    return promise
  }
  catch {
    return null
  }
}

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** The system color scheme: what MAX (it has no theme in its SDK) and the website go by. */
export function mediaColorScheme(): ColorScheme {
  return window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'
}

export function onMediaColorSchemeChange(callback: (scheme: ColorScheme) => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY)
  if (!query) return () => {}
  const listener = () => callback(mediaColorScheme())
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

/**
 * Opens a new tab, falling back to this one when a popup blocker refuses.
 * Only web, mail and phone links: a `javascript:` URL would run in the page,
 * the way the messengers' own `openLink` never lets it.
 */
export function openInNewTab(url: string): void {
  let protocol: string
  try {
    protocol = new URL(url, window.location.href).protocol
  }
  catch {
    return
  }
  if (!OPENABLE_PROTOCOLS.has(protocol)) return

  // Without 'noopener' in the features: with it window.open always returns
  // null and the fallback would leave the page even when the tab opened.
  const opened = window.open(url, '_blank')
  if (opened) {
    opened.opener = null
    return
  }
  window.location.href = url
}
