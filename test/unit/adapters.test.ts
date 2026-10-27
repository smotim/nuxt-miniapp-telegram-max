import { describe, expect, it, vi } from 'vitest'
import { createMaxSdk } from '../../src/runtime/client/adapters/max'
import { createTelegramSdk } from '../../src/runtime/client/adapters/telegram'
import type { MaxWebApp, TelegramWebApp } from '../../src/runtime/types'

function telegram(overrides: Partial<TelegramWebApp> = {}): TelegramWebApp {
  return { initData: '', ...overrides }
}

function max(overrides: Partial<MaxWebApp> = {}): MaxWebApp {
  return { initData: '', ...overrides }
}

describe('Telegram', () => {
  it('turns the popup callback into a promise with an ok button by default', async () => {
    const showPopup = vi.fn((_params, callback?: (id: string) => void) => callback?.(''))
    const sdk = createTelegramSdk(telegram({ showPopup }), null)

    await expect(sdk.showPopup({ message: 'Hi' })).resolves.toBe('ok')
    expect(showPopup.mock.calls[0]![0]).toMatchObject({ buttons: [{ type: 'ok' }] })
  })

  it('answers null for dialogs the client lacks or refuses', () => {
    expect(createTelegramSdk(telegram(), null).showPopup({ message: 'Hi' })).toBeNull()
    const refusing = createTelegramSdk(telegram({ showConfirm: () => {
      throw new Error('WebAppPopupOpened')
    } }), null)
    expect(refusing.showConfirm('Sure?')).toBeNull()
  })

  it('reports downloads the client cannot do as unsupported', async () => {
    expect(await createTelegramSdk(telegram(), null).downloadFile('https://x/a.pdf', 'a.pdf')).toBe('unsupported')
    const throwing = createTelegramSdk(telegram({ downloadFile: () => {
      throw new Error('WebAppMethodUnsupported')
    } }), null)
    expect(await throwing.downloadFile('https://x/a.pdf', 'a.pdf')).toBe('unsupported')
  })

  it('opens Telegram links inside Telegram and the rest in the browser', () => {
    const openLink = vi.fn()
    const openTelegramLink = vi.fn()
    const sdk = createTelegramSdk(telegram({ openLink, openTelegramLink }), null)

    sdk.openInternalLink('https://t.me/support')
    sdk.openInternalLink('https://example.com')
    sdk.openInternalLink('http://t.me/support')

    expect(openTelegramLink.mock.calls).toEqual([['https://t.me/support']])
    expect(openLink.mock.calls).toEqual([['https://example.com'], ['http://t.me/support']])
  })

  it('takes the platform from the hash when the SDK has none', () => {
    expect(createTelegramSdk(telegram(), 'android').platform).toBe('android')
    expect(createTelegramSdk(telegram({ platform: 'ios' }), 'android').platform).toBe('ios')
    expect(createTelegramSdk(telegram(), null).platform).toBe('unknown')
  })
})

describe('MAX', () => {
  it('swallows the rejected haptic promise of MAX in a browser', async () => {
    const rejection = Promise.reject(new Error('client.unsupported_method'))
    const sdk = createMaxSdk(max({ HapticFeedback: { impactOccurred: () => rejection } }), null)

    expect(() => sdk.haptics.impact('light')).not.toThrow()
    await rejection.catch(() => {})
  })

  it('maps the statuses of its promises', async () => {
    const sdk = createMaxSdk(max({
      downloadFile: () => Promise.resolve({ status: 'cancelled' }),
      shareMaxContent: () => Promise.reject(new Error('client.unsupported_method')),
    }), null)

    expect(await sdk.downloadFile('https://x/a.pdf', 'a.pdf')).toBe('cancelled')
    expect(await sdk.sharePreparedMessage({ mid: 'mid.1', chatType: 'DIALOG' })).toBe('unsupported')
  })

  it('has no native dialogs and no write access request', async () => {
    const sdk = createMaxSdk(max(), null)
    expect(sdk.showPopup({ message: 'Hi' })).toBeNull()
    expect(sdk.canRequestWriteAccess()).toBe(false)
    expect(await sdk.requestWriteAccess()).toBe(false)
  })

  it('switches vertical swipes, which its SDK has but does not document', () => {
    const disableVerticalSwipes = vi.fn(() => Promise.resolve({}))
    createMaxSdk(max({ disableVerticalSwipes }), null).setVerticalSwipes(false)
    expect(disableVerticalSwipes).toHaveBeenCalled()
  })

  it('opens max.ru links inside MAX', () => {
    const openMaxLink = vi.fn()
    createMaxSdk(max({ openMaxLink, openLink: vi.fn() }), null).openInternalLink('https://max.ru/support')
    expect(openMaxLink).toHaveBeenCalledWith('https://max.ru/support')
  })
})
