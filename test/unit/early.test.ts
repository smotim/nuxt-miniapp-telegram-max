import { beforeEach, describe, expect, it } from 'vitest'
import { earlyDetect, STORAGE_PREFIX } from '../../src/early'
import { STORAGE_PREFIX as RUNTIME_STORAGE_PREFIX } from '../../src/runtime/client/storage'
import { detectClient, resetDetectedClient } from '../../src/runtime/client/launch'

const options = { prefix: STORAGE_PREFIX, classPrefix: 'mini-app-', attribute: 'data-color-scheme' }

/** The same way the page runs it: from its source text. */
function runAsInlineScript() {
  new Function(`(${earlyDetect.toString()})(${JSON.stringify(options)})`)()
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  resetDetectedClient()
  document.documentElement.className = ''
  document.documentElement.removeAttribute('data-color-scheme')
  window.history.replaceState(null, '', '/')
})

describe('earlyDetect', () => {
  it('shares the storage prefix with the runtime', () => {
    expect(STORAGE_PREFIX).toBe(RUNTIME_STORAGE_PREFIX)
  })

  it('marks <html>, restores the scheme, and hands the launch to the runtime', () => {
    localStorage.setItem(`${STORAGE_PREFIX}color-scheme`, 'dark')
    window.history.replaceState(null, '', '/#tgWebAppData=x&tgWebAppPlatform=ios')
    runAsInlineScript()
    window.history.replaceState(null, '', '/')

    expect(document.documentElement.classList.contains('mini-app-telegram')).toBe(true)
    expect(document.documentElement.getAttribute('data-color-scheme')).toBe('dark')
    expect(detectClient()).toBe('telegram')
  })

  it('leaves the website alone', () => {
    localStorage.setItem(`${STORAGE_PREFIX}color-scheme`, 'dark')
    runAsInlineScript()

    expect(document.documentElement.className).toBe('')
    expect(document.documentElement.hasAttribute('data-color-scheme')).toBe(false)
  })
})
