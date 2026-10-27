import { describe, expect, it } from 'vitest'
import { isCompleteInitData, parseInitData, parseInitDataFields } from '../../src/runtime/shared/initData'
import { validateInitData } from '../../src/runtime/shared/validate'
import { signInitData, userFields } from '../signInitData'

const BOT_TOKEN = '123456:test-token-not-real'

/** Signed by an independent PHP implementation, as a vector from outside this code. */
const PHP_SIGNED = 'auth_date=1761580800&query_id=AAHdF6IQAAAAAN0XohDhrOrc&start_param=lecture_42'
  + '&user=%7B%22id%22%3A1001%2C%22first_name%22%3A%22Test%20User%22%2C%22language_code%22%3A%22ru%22%7D'
  + '&hash=1f31a6f31500b31a9cbcf634a0853f15a5af10d538d74adf9fc66bb7de31fa62'
const PHP_SIGNED_AT = 1761580800 * 1000

describe('parseInitDataFields', () => {
  it('keeps every value a string, even under an array-like key', () => {
    expect(parseInitDataFields('hash[]=a&hash[]=b&x=1')).toEqual({ 'hash[]': 'b', 'x': '1' })
  })

  it('decodes like a form and survives a broken escape', () => {
    expect(parseInitDataFields('a=Anna+Maria&b=%E2%9C%93&c=100%')).toEqual({ a: 'Anna Maria', b: '✓', c: '100%' })
  })

  it('keeps __proto__ a plain key', () => {
    const fields = parseInitDataFields('__proto__=x&a=1')
    expect(Object.getPrototypeOf(fields)).toBeNull()
    expect(fields.__proto__).toBe('x')
  })
})

describe('parseInitData', () => {
  it('reads the user, the start parameter and the date', () => {
    const data = parseInitData(PHP_SIGNED)
    expect(data.user).toMatchObject({ id: 1001, first_name: 'Test User' })
    expect(data.startParam).toBe('lecture_42')
    expect(data.authDate).toBe(1761580800)
  })

  it('leaves out JSON it cannot read', () => {
    expect(parseInitData('user=%7Bbroken&auth_date=x').user).toBeUndefined()
    expect(parseInitData('auth_date=x').authDate).toBeNull()
  })
})

describe('isCompleteInitData', () => {
  it('rejects what Telegram leaves of initData on Android and desktop', () => {
    expect(isCompleteInitData('query_id')).toBe(false)
    expect(isCompleteInitData('query_id=AAH')).toBe(false)
    expect(isCompleteInitData(PHP_SIGNED)).toBe(true)
  })
})

describe('validateInitData', () => {
  it('accepts data signed by another implementation', async () => {
    const result = await validateInitData(PHP_SIGNED, BOT_TOKEN, { now: PHP_SIGNED_AT })
    expect(result.valid).toBe(true)
  })

  it('accepts data of both messengers signed the same way', async () => {
    const telegram = signInitData(userFields({ id: 1, first_name: 'Ann' }), BOT_TOKEN)
    const max = signInitData(userFields({ id: 2, first_name: 'Max' }, { chat: JSON.stringify({ id: 5, type: 'DIALOG' }), ip: '10.0.0.1' }), BOT_TOKEN)

    expect(await validateInitData(telegram, BOT_TOKEN)).toMatchObject({ valid: true, data: { user: { first_name: 'Ann' } } })
    expect(await validateInitData(max, BOT_TOKEN)).toMatchObject({ valid: true, data: { chat: { type: 'DIALOG' } } })
  })

  it('refuses a changed field, another bot and a missing hash', async () => {
    const tampered = PHP_SIGNED.replace('lecture_42', 'lecture_43')
    expect(await validateInitData(tampered, BOT_TOKEN, { now: PHP_SIGNED_AT })).toEqual({ valid: false, reason: 'signature' })
    expect(await validateInitData(PHP_SIGNED, '1:other', { now: PHP_SIGNED_AT })).toEqual({ valid: false, reason: 'signature' })
    expect(await validateInitData('auth_date=1&user=%7B%7D', BOT_TOKEN)).toEqual({ valid: false, reason: 'malformed' })
    expect(await validateInitData('', BOT_TOKEN)).toEqual({ valid: false, reason: 'missing' })
  })

  it('refuses a repeated key put in front of valid data', async () => {
    const forgedUser = encodeURIComponent(JSON.stringify({ id: 1, first_name: 'Forged' }))
    expect(await validateInitData(`user=${forgedUser}&${PHP_SIGNED}`, BOT_TOKEN, { now: PHP_SIGNED_AT }))
      .toEqual({ valid: false, reason: 'malformed' })
    expect(await validateInitData(`${PHP_SIGNED}&__proto__=x`, BOT_TOKEN, { now: PHP_SIGNED_AT }))
      .toEqual({ valid: false, reason: 'signature' })
  })

  it('refuses data signed in the future beyond clock drift', async () => {
    expect((await validateInitData(PHP_SIGNED, BOT_TOKEN, { now: PHP_SIGNED_AT - 60_000 })).valid).toBe(true)
    expect(await validateInitData(PHP_SIGNED, BOT_TOKEN, { now: PHP_SIGNED_AT - 3_600_000 }))
      .toEqual({ valid: false, reason: 'malformed' })
  })

  it('refuses data older than maxAge, unless the check is off', async () => {
    const dayLater = PHP_SIGNED_AT + 86_401_000
    expect(await validateInitData(PHP_SIGNED, BOT_TOKEN, { now: dayLater })).toEqual({ valid: false, reason: 'expired' })
    expect((await validateInitData(PHP_SIGNED, BOT_TOKEN, { now: dayLater, maxAge: false })).valid).toBe(true)
  })

  it('needs a bot token', async () => {
    await expect(validateInitData(PHP_SIGNED, '')).rejects.toThrow('bot token')
  })
})
