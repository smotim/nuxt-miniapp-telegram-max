import type { MaxWebApp, MessengerClient, TelegramWebApp } from '../types'
import type { SdkWindow } from './launch'

/** How long a native dialog may stay unanswered before it counts as the fallback status. */
export const NATIVE_RESPONSE_TIMEOUT_MS = 30_000

/**
 * Calls the SDK and swallows what it throws or rejects. Old clients expose
 * methods they cannot run, and MAX in a browser rejects the promise of every
 * haptic call — an unhandled rejection per tap otherwise.
 */
export function callSdkSafely(action: () => unknown): void {
  try {
    const result = action()
    if (result instanceof Promise) result.catch(() => {})
  }
  catch {
    // The client exposes the method but cannot run it.
  }
}

/** A callback-style SDK call as a promise that settles with `timeoutStatus` if the client stays silent. */
export function waitForSdkStatus<TStatus extends string>(
  timeoutStatus: TStatus,
  request: (settle: (status: TStatus) => void) => void,
): Promise<TStatus> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => settle(timeoutStatus), NATIVE_RESPONSE_TIMEOUT_MS)
    function settle(status: TStatus) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(status)
    }

    try {
      request(settle)
    }
    catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })
}

export function sdkOf(client: 'telegram'): TelegramWebApp | undefined
export function sdkOf(client: 'max'): MaxWebApp | undefined
export function sdkOf(client: MessengerClient): TelegramWebApp | MaxWebApp | undefined
export function sdkOf(client: MessengerClient): TelegramWebApp | MaxWebApp | undefined {
  const globals = window as SdkWindow
  return client === 'telegram' ? globals.Telegram?.WebApp : globals.WebApp
}

/**
 * The messenger's SDK: already on the page, or loaded from `src`. A script tag
 * with the same `src` (added by the app itself) is waited for, not added twice.
 * Resolves to undefined when the SDK does not come — no network, a blocked CDN.
 */
export async function loadSdk(client: MessengerClient, src: string, timeoutMs: number): Promise<TelegramWebApp | MaxWebApp | undefined> {
  const present = sdkOf(client)
  if (present) return present

  try {
    await loadScript(src, timeoutMs)
  }
  catch {
    return undefined
  }
  return sdkOf(client)
}

function loadScript(src: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const absolute = new URL(src, window.location.href).href
    let script = Array.from(document.scripts).find(element => element.src === absolute)
    if (!script) {
      script = document.createElement('script')
      script.src = src
      script.async = true
      document.head.appendChild(script)
    }

    const timer = setTimeout(() => reject(new Error(`nuxt-miniapp-telegram-max: ${src} did not load in ${timeoutMs} ms`)), timeoutMs)
    script.addEventListener('load', () => {
      clearTimeout(timer)
      resolve()
    }, { once: true })
    script.addEventListener('error', () => {
      clearTimeout(timer)
      reject(new Error(`nuxt-miniapp-telegram-max: ${src} failed to load`))
    }, { once: true })
  })
}
