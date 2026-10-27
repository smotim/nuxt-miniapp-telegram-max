import { beforeEach, describe, expect, it } from 'vitest'
import {
  claimStartParam,
  clearLaunchHash,
  clientOfHash,
  detectClient,
  extractInitData,
  launchHashParam,
  resetDetectedClient,
  resolveInitData,
} from '../../src/runtime/client/launch'

const INIT_DATA = 'auth_date=1761580800&query_id=AAH&user=%7B%22id%22%3A1%7D&hash=abc123'

function setHash(hash: string) {
  window.history.replaceState(null, '', `/page${hash ? `#${hash}` : ''}`)
}

beforeEach(() => {
  sessionStorage.clear()
  resetDetectedClient()
  setHash('')
  delete (window as { Telegram?: unknown }).Telegram
  delete (window as { WebApp?: unknown }).WebApp
})

describe('clientOfHash', () => {
  it('tells Telegram from MAX by the parameter names', () => {
    expect(clientOfHash(`tgWebAppData=${encodeURIComponent(INIT_DATA)}&tgWebAppPlatform=ios`)).toBe('telegram')
    expect(clientOfHash(`WebAppData=${encodeURIComponent(INIT_DATA)}&WebAppPlatform=android`)).toBe('max')
    expect(clientOfHash('section=WebAppData=no')).toBeNull()
    expect(clientOfHash('')).toBeNull()
  })

  it('needs data to take a hash for MAX: its parameter names are generic', () => {
    expect(clientOfHash('WebAppPlatform=1')).toBeNull()
    expect(clientOfHash('tgWebAppPlatform=ios&tgWebAppVersion=9.0')).toBe('telegram')
  })
})

describe('extractInitData', () => {
  it('reads Telegram data', () => {
    expect(extractInitData(`tgWebAppData=${encodeURIComponent(INIT_DATA)}&tgWebAppVersion=9.0`, 'telegram')).toBe(INIT_DATA)
  })

  it('reads MAX data encoded as one parameter', () => {
    expect(extractInitData(`WebAppData=${encodeURIComponent(INIT_DATA)}&WebAppPlatform=ios`, 'max')).toBe(INIT_DATA)
  })

  it('reads MAX data sent as plain fields among its service keys', () => {
    const hash = `WebAppData=auth_date=1761580800&query_id=AAH&user=%7B%22id%22%3A1%7D&hash=abc123&WebAppPlatform=ios&WebAppVersion=1`
    expect(extractInitData(hash, 'max')).toBe(INIT_DATA)
  })

  it('ignores data cut short', () => {
    expect(extractInitData('tgWebAppData=query_id', 'telegram')).toBeNull()
  })
})

describe('detectClient', () => {
  it('is the website without launch parameters', () => {
    expect(detectClient()).toBe('web')
  })

  it('takes the client from the hash and keeps it for reloads without one', () => {
    setHash(`WebAppData=${encodeURIComponent(INIT_DATA)}`)
    expect(detectClient()).toBe('max')

    resetDetectedClient()
    setHash('')
    expect(detectClient()).toBe('max')
  })

  it('falls back to the SDK globals', () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: INIT_DATA } }
    expect(detectClient()).toBe('telegram')
  })
})

describe('resolveInitData', () => {
  it('skips the cut-short SDK value for the hash, then remembers it for the tab', () => {
    setHash(`tgWebAppData=${encodeURIComponent(INIT_DATA)}`)
    detectClient()
    expect(resolveInitData('telegram', 'query_id')).toBe(INIT_DATA)

    setHash('')
    expect(resolveInitData('telegram', '')).toBe(INIT_DATA)
  })

  it('prefers whole SDK data', () => {
    const fromSdk = INIT_DATA.replace('abc123', 'def456')
    setHash(`tgWebAppData=${encodeURIComponent(INIT_DATA)}`)
    expect(resolveInitData('telegram', fromSdk)).toBe(fromSdk)
  })
})

describe('launch hash', () => {
  it('reads the platform and start parameter of the launch after the hash is gone', () => {
    setHash(`tgWebAppData=${encodeURIComponent(INIT_DATA)}&tgWebAppPlatform=android&tgWebAppStartParam=lecture_42`)
    detectClient()
    clearLaunchHash()

    expect(window.location.hash).toBe('')
    expect(window.location.pathname).toBe('/page')
    expect(launchHashParam('telegram', 'platform')).toBe('android')
    expect(launchHashParam('telegram', 'startParam')).toBe('lecture_42')
  })

  it('gives a start parameter once per launch: not after a reload, again on a new launch', () => {
    expect(claimStartParam('lecture_42', 'hash-a')).toBe(true)
    expect(claimStartParam('lecture_42', 'hash-a')).toBe(false)
    expect(claimStartParam('lecture_42', 'hash-b')).toBe(true)
    expect(claimStartParam('lecture_43', 'hash-b')).toBe(true)
  })
})
