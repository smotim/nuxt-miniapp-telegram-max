import type { MiniAppChat, MiniAppInitData, MiniAppUser } from '../types'

/**
 * Splits init data into `[key, value]` pairs by hand rather than with a
 * framework parser: every value stays a string (`hash[]=` must not become an
 * array) and keys stay exactly as the messenger signed them. Values are decoded
 * like a form (`+` is a space), which is how both messengers encode them.
 */
export function parseInitDataPairs(raw: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = []

  for (const pair of raw.split('&')) {
    if (pair === '') continue
    const separator = pair.indexOf('=')
    const key = separator === -1 ? pair : pair.slice(0, separator)
    const value = separator === -1 ? '' : pair.slice(separator + 1)
    pairs.push([decode(key), decode(value)])
  }

  return pairs
}

/**
 * The fields as an object without a prototype, so a `__proto__` key is just a
 * key. A repeated key keeps its last value; validation refuses repeats.
 */
export function parseInitDataFields(raw: string): Record<string, string> {
  const fields: Record<string, string> = Object.create(null)
  for (const [key, value] of parseInitDataPairs(raw)) fields[key] = value
  return fields
}

export function parseInitData(raw: string): MiniAppInitData {
  const fields = parseInitDataFields(raw)
  const authDate = Number(fields.auth_date)

  return {
    authDate: fields.auth_date && Number.isInteger(authDate) ? authDate : null,
    hash: fields.hash || null,
    queryId: fields.query_id || undefined,
    startParam: fields.start_param || undefined,
    user: parseJson<MiniAppUser>(fields.user),
    receiver: parseJson<MiniAppUser>(fields.receiver),
    chat: parseJson<MiniAppChat>(fields.chat),
    chatType: fields.chat_type || undefined,
    chatInstance: fields.chat_instance || undefined,
    fields,
  }
}

/**
 * Whether the string is whole init data rather than a fragment: Telegram's
 * SDK on Android and desktop has been seen cutting `initData` down to
 * `query_id`, which still looks like data but can never pass the signature.
 */
export function isCompleteInitData(raw: string | null | undefined): raw is string {
  if (!raw) return false
  const fields = parseInitDataFields(raw)
  return !!fields.hash && !!fields.auth_date
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  }
  catch {
    return value
  }
}

function parseJson<T>(value: string | undefined): T | undefined {
  if (!value) return undefined
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as T : undefined
  }
  catch {
    return undefined
  }
}
