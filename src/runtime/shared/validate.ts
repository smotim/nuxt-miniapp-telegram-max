import type { MiniAppInitData } from '../types'
import { parseInitData, parseInitDataFields, parseInitDataPairs } from './initData'

export type InitDataFailure = 'missing' | 'malformed' | 'signature' | 'expired'

export type InitDataValidation
  = | { valid: true, data: MiniAppInitData }
    | { valid: false, reason: InitDataFailure }

export interface ValidateInitDataOptions {
  /** Seconds init data stays valid after `auth_date`; `false` turns the check off. Default: one day. */
  maxAge?: number | false
  /** Current time in milliseconds, for tests. */
  now?: number
}

const DEFAULT_MAX_AGE = 86_400
/** How far `auth_date` may run ahead of the server's clock, seconds. */
const CLOCK_SKEW = 300
const encoder = new TextEncoder()

/**
 * Checks init data from a Telegram or MAX mini app. Both messengers sign it the
 * same way: HMAC-SHA256 of the sorted `key=value` lines, keyed with
 * HMAC-SHA256("WebAppData", bot token). Web Crypto only, so it runs on Node,
 * Bun, Deno and edge workers alike.
 *
 * A day by default: web versions of the messengers send the same init data
 * for as long as the tab stays open.
 *
 * @see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @see https://dev.max.ru/docs/webapps/validation
 */
export async function validateInitData(
  raw: string | null | undefined,
  botToken: string,
  options: ValidateInitDataOptions = {},
): Promise<InitDataValidation> {
  if (!raw) return { valid: false, reason: 'missing' }
  if (!botToken) throw new Error('nuxt-miniapp-telegram-max: validateInitData needs the bot token')

  // A repeated key is never signed data: `user=<forged>&<valid data>` would pass
  // the signature with the last `user`, while anyone re-reading the raw string
  // with URLSearchParams.get() would take the first, forged one.
  const pairs = parseInitDataPairs(raw)
  if (new Set(pairs.map(([key]) => key)).size !== pairs.length) return { valid: false, reason: 'malformed' }

  const fields = parseInitDataFields(raw)
  const providedHash = fields.hash
  if (!providedHash) return { valid: false, reason: 'malformed' }

  const dataCheckString = Object.keys(fields)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${fields[key]}`)
    .join('\n')

  const secret = await hmac(encoder.encode('WebAppData'), encoder.encode(botToken))
  const expectedHash = toHex(await hmac(secret, encoder.encode(dataCheckString)))
  if (!timingSafeEqual(expectedHash, providedHash.toLowerCase())) {
    return { valid: false, reason: 'signature' }
  }

  const data = parseInitData(raw)
  if (data.authDate === null) return { valid: false, reason: 'malformed' }

  const maxAge = options.maxAge ?? DEFAULT_MAX_AGE
  const now = Math.floor((options.now ?? Date.now()) / 1000)
  if (maxAge !== false && now - data.authDate > maxAge) {
    return { valid: false, reason: 'expired' }
  }
  // Signed in the future beyond any clock drift: the messenger never does that.
  if (data.authDate - now > CLOCK_SKEW) return { valid: false, reason: 'malformed' }

  return { valid: true, data }
}

async function hmac(key: BufferSource, data: BufferSource): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', cryptoKey, data)
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return difference === 0
}
