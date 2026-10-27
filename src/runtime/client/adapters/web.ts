import type { MiniAppHaptics, WebMiniAppSdk } from '../../types'
import { mediaColorScheme, onMediaColorSchemeChange, openInNewTab } from './shared'

const noop = () => {}

const haptics: MiniAppHaptics = {
  supported: false,
  impact: noop,
  notification: noop,
  selection: noop,
}

/**
 * The website, and a mini app whose SDK never came. Safe on the server: it
 * touches `window` only when a method is called.
 */
export function createWebSdk(): WebMiniAppSdk {
  return {
    client: 'web',
    raw: null,
    platform: 'web',
    get colorScheme() {
      return typeof window === 'undefined' ? 'light' : mediaColorScheme()
    },
    onColorSchemeChange: callback => (typeof window === 'undefined' ? noop : onMediaColorSchemeChange(callback)),

    ready: noop,
    close: noop,
    expand: noop,
    setVerticalSwipes: noop,
    setClosingConfirmation: noop,

    openLink: openInNewTab,
    openInternalLink: openInNewTab,

    haptics,
    pushBackButton: () => noop,

    showPopup: () => null,
    showConfirm: () => null,

    downloadFile: () => Promise.resolve('unsupported'),
    canSharePreparedMessage: () => false,
    canRequestWriteAccess: () => false,
    requestWriteAccess: () => Promise.resolve(false),
  }
}
