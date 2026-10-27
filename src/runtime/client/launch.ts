import { isCompleteInitData } from '../shared/initData'
import type { MaxWebApp, MessengerClient, MiniAppClient, TelegramWebApp } from '../types'
import { sessionGet, sessionSet } from './storage'

/**
 * Launch parameters arrive in the URL hash: Telegram's as `#tgWebAppData=…`,
 * MAX's as `#WebAppData=…`. The router drops the hash on the first navigation,
 * so it is copied to sessionStorage, which survives reloads of the tab.
 * The inline script of `earlyDetect` writes `client` and `launch-hash` too.
 */
const KEYS = {
  client: 'client',
  hash: 'launch-hash',
  startParamClaimed: 'start-param-claimed',
  initData: (client: MessengerClient) => `init-data:${client}`,
}

const HASH_PARAMS = {
  telegram: { data: 'tgWebAppData', platform: 'tgWebAppPlatform', startParam: 'tgWebAppStartParam' },
  max: { data: 'WebAppData', platform: 'WebAppPlatform', startParam: 'WebAppStartParam' },
} as const

/** Service keys of the MAX hash: in the unencoded form they sit next to the data fields. */
const MAX_SERVICE_KEYS = new Set(['WebAppData', 'WebAppPlatform', 'WebAppVersion', 'WebAppDeviceName', 'WebAppStartParam'])

/**
 * Telegram's parameter names are its own, and some launches come without data.
 * MAX's are generic, so it takes the data itself: a stray `#WebAppPlatform=` on
 * a website link must not switch a visitor into MAX and load MAX's script.
 */
export function clientOfHash(hash: string): MessengerClient | null {
  if (/(?:^|&)tgWebApp(?:Data|Platform)=/.test(hash)) return 'telegram'
  if (/(?:^|&)WebAppData=/.test(hash)) return 'max'
  return null
}

function currentHash(): string {
  const hash = window.location.hash
  return hash.startsWith('#') ? hash.slice(1) : hash
}

/** Copies launch parameters from the URL hash, if it has them. */
export function captureLaunchHash(): void {
  const hash = currentHash()
  const client = clientOfHash(hash)
  if (!client) return
  sessionSet(KEYS.client, client)
  sessionSet(KEYS.hash, hash)
}

/** The launch hash: the current one, or the one captured earlier in this tab. */
function launchHash(): string {
  const hash = currentHash()
  return clientOfHash(hash) ? hash : (sessionGet(KEYS.hash) ?? '')
}

let detected: MiniAppClient | null = null

/**
 * Which client the app runs in, synchronously: by the tab's record, the launch
 * hash, then the SDK globals. Cached for the page. Always `web` on the server.
 */
export function detectClient(): MiniAppClient {
  if (typeof window === 'undefined') return 'web'
  if (detected) return detected

  const stored = sessionGet(KEYS.client)
  if (stored === 'telegram' || stored === 'max') return (detected = stored)

  const fromHash = clientOfHash(currentHash())
  if (fromHash) {
    captureLaunchHash()
    return (detected = fromHash)
  }

  const globals = window as SdkWindow
  if (globals.Telegram?.WebApp?.initData) return (detected = 'telegram')
  if (globals.WebApp?.initData) return (detected = 'max')

  return (detected = 'web')
}

export function extractInitData(hash: string, client: MessengerClient): string | null {
  if (!hash) return null
  const params = new URLSearchParams(hash)

  if (client === 'telegram') {
    const value = params.get(HASH_PARAMS.telegram.data)
    return isCompleteInitData(value) ? value : null
  }

  // MAX sends the data either encoded as one parameter or as plain fields
  // after `WebAppData=`, mixed with its service keys.
  const nested = params.get(HASH_PARAMS.max.data)
  if (isCompleteInitData(nested)) return nested

  const marker = `${HASH_PARAMS.max.data}=`
  const start = hash.indexOf(marker)
  const flat = new URLSearchParams(start === -1 ? hash : hash.slice(start + marker.length))
  const fields = new URLSearchParams()
  flat.forEach((value, key) => {
    if (key && !MAX_SERVICE_KEYS.has(key)) fields.append(key, value)
  })
  const value = fields.toString()
  return isCompleteInitData(value) ? value : null
}

/**
 * Init data in order of trust: the SDK's if whole (it can be cut short), the
 * current hash, the captured hash, the copy kept for this tab.
 */
export function resolveInitData(client: MessengerClient, fromSdk: string | null | undefined): string {
  const value = [fromSdk, extractInitData(currentHash(), client), extractInitData(sessionGet(KEYS.hash) ?? '', client), sessionGet(KEYS.initData(client))]
    .find(isCompleteInitData) ?? ''

  if (value) sessionSet(KEYS.initData(client), value)
  return value
}

export function hasLaunchInitData(client: MessengerClient): boolean {
  return !!extractInitData(launchHash(), client) || isCompleteInitData(sessionGet(KEYS.initData(client)))
}

export function launchHashParam(client: MessengerClient, param: 'platform' | 'startParam'): string | null {
  const hash = launchHash()
  if (!hash) return null
  return new URLSearchParams(hash).get(HASH_PARAMS[client][param]) || null
}

/**
 * True once per launch: the parameter survives reloads, and acting on it again
 * would send the user back to the page of the link. A launch is told by its
 * init data (signed anew on every launch), not by the parameter alone — web
 * versions of the messengers open the same link again in the same tab.
 */
export function claimStartParam(param: string, launchId: string): boolean {
  const claim = `${launchId}|${param}`
  if (sessionGet(KEYS.startParamClaimed) === claim) return false
  sessionSet(KEYS.startParamClaimed, claim)
  return true
}

/** Whether the URL hash carries launch parameters. */
export function isLaunchHash(hash: string): boolean {
  return !!clientOfHash(hash.startsWith('#') ? hash.slice(1) : hash)
}

/**
 * Removes launch parameters from the address bar of an app without a router;
 * they stay in sessionStorage. With a router, replace the route instead, or
 * the route keeps them (plugin.client.ts).
 */
export function clearLaunchHash(): void {
  if (!isLaunchHash(currentHash())) return
  try {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }
  catch {
    // A sandboxed frame may forbid it; the hash then just stays.
  }
}

/** Waits for init data to appear in the hash: iOS Telegram may set it after load. */
export function waitForLaunchInitData(client: MessengerClient, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      window.removeEventListener('hashchange', check)
      resolve()
    }
    const check = () => {
      captureLaunchHash()
      if (hasLaunchInitData(client)) finish()
    }
    const timer = setTimeout(finish, timeoutMs)
    window.addEventListener('hashchange', check)
  })
}

export interface SdkWindow {
  Telegram?: { WebApp?: TelegramWebApp }
  WebApp?: MaxWebApp
}

/** For tests: forget the cached client. */
export function resetDetectedClient(): void {
  detected = null
}
