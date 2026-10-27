import type { MaxMiniAppSdk, MaxWebApp, MiniAppHaptics } from '../../types'
import { createBackButtonStack } from '../backButton'
import { callSdkSafely } from '../sdk'
import { isLinkOf, mediaColorScheme, onMediaColorSchemeChange } from './shared'

const MAX_LINK_HOSTS = ['max.ru']

export function createMaxSdk(max: MaxWebApp, platformFallback: string | null): MaxMiniAppSdk {
  const backButton = createBackButtonStack(max.BackButton)

  const haptics: MiniAppHaptics = {
    supported: !!max.HapticFeedback,
    impact: style => callSdkSafely(() => max.HapticFeedback?.impactOccurred?.(style)),
    notification: type => callSdkSafely(() => max.HapticFeedback?.notificationOccurred?.(type)),
    selection: () => callSdkSafely(() => max.HapticFeedback?.selectionChanged?.()),
  }

  /** MAX answers with a promise that rejects where the client lacks the method. */
  async function settle<T extends string>(call: () => Promise<{ status?: string } | undefined> | undefined, map: (status: string | undefined) => T): Promise<T | 'unsupported'> {
    try {
      const result = call()
      return result ? map((await result)?.status) : 'unsupported'
    }
    catch {
      return 'unsupported'
    }
  }

  return {
    client: 'max',
    raw: max,
    platform: max.platform || platformFallback || 'unknown',
    // No theme in MAX's SDK: the webview follows the system scheme.
    get colorScheme() {
      return mediaColorScheme()
    },
    onColorSchemeChange: onMediaColorSchemeChange,

    ready: () => callSdkSafely(() => max.ready?.()),
    close: () => callSdkSafely(() => max.close?.()),
    // MAX's SDK has no expand.
    expand: () => {},
    setVerticalSwipes: enabled => callSdkSafely(() => (enabled ? max.enableVerticalSwipes?.() : max.disableVerticalSwipes?.())),
    setClosingConfirmation: enabled => callSdkSafely(() => (enabled ? max.enableClosingConfirmation?.() : max.disableClosingConfirmation?.())),

    openLink: url => callSdkSafely(() => max.openLink?.(url)),
    openInternalLink(url) {
      if (isLinkOf(url, MAX_LINK_HOSTS) && typeof max.openMaxLink === 'function') {
        callSdkSafely(() => max.openMaxLink?.(url))
      }
      else {
        callSdkSafely(() => max.openLink?.(url))
      }
    },

    haptics,
    pushBackButton: handler => backButton.push(handler),

    // MAX has no native popups.
    showPopup: () => null,
    showConfirm: () => null,

    downloadFile: (url, fileName) => settle(
      () => max.downloadFile?.(url, fileName),
      status => (status === 'cancelled' ? 'cancelled' : 'downloading'),
    ),
    canSharePreparedMessage: () => typeof max.shareMaxContent === 'function',
    sharePreparedMessage: message => settle(
      () => max.shareMaxContent?.({ mid: message.mid, chatType: message.chatType }),
      status => (status === 'cancelled' ? 'cancelled' : 'shared'),
    ),
    canRequestWriteAccess: () => false,
    requestWriteAccess: () => Promise.resolve(false),
  }
}
