import type { ColorScheme, DownloadStatus, MiniAppHaptics, ShareStatus, TelegramMiniAppSdk, TelegramWebApp } from '../../types'
import { createBackButtonStack } from '../backButton'
import { callSdkSafely, waitForSdkStatus } from '../sdk'
import { callWithCallback, isLinkOf } from './shared'

const TELEGRAM_LINK_HOSTS = ['t.me', 'telegram.me']

export function createTelegramSdk(tg: TelegramWebApp, platformFallback: string | null): TelegramMiniAppSdk {
  const backButton = createBackButtonStack(tg.BackButton)
  const colorScheme = (): ColorScheme => (tg.colorScheme === 'dark' ? 'dark' : 'light')

  const haptics: MiniAppHaptics = {
    supported: !!tg.HapticFeedback,
    impact: style => callSdkSafely(() => tg.HapticFeedback?.impactOccurred?.(style)),
    notification: type => callSdkSafely(() => tg.HapticFeedback?.notificationOccurred?.(type)),
    selection: () => callSdkSafely(() => tg.HapticFeedback?.selectionChanged?.()),
  }

  return {
    client: 'telegram',
    raw: tg,
    platform: tg.platform || platformFallback || 'unknown',
    get colorScheme() {
      return colorScheme()
    },
    onColorSchemeChange(callback) {
      const listener = () => callback(colorScheme())
      callSdkSafely(() => tg.onEvent?.('themeChanged', listener))
      return () => callSdkSafely(() => tg.offEvent?.('themeChanged', listener))
    },

    ready: () => callSdkSafely(() => tg.ready?.()),
    close: () => callSdkSafely(() => tg.close?.()),
    expand: () => callSdkSafely(() => tg.expand?.()),
    setVerticalSwipes: enabled => callSdkSafely(() => (enabled ? tg.enableVerticalSwipes?.() : tg.disableVerticalSwipes?.())),
    setClosingConfirmation: enabled => callSdkSafely(() => (enabled ? tg.enableClosingConfirmation?.() : tg.disableClosingConfirmation?.())),

    openLink: url => callSdkSafely(() => tg.openLink?.(url)),
    openInternalLink(url) {
      if (isLinkOf(url, TELEGRAM_LINK_HOSTS) && typeof tg.openTelegramLink === 'function') {
        callSdkSafely(() => tg.openTelegramLink?.(url))
      }
      else {
        callSdkSafely(() => tg.openLink?.(url))
      }
    },

    haptics,
    pushBackButton: handler => backButton.push(handler),

    showPopup(params) {
      const showPopup = tg.showPopup
      if (typeof showPopup !== 'function') return null
      return callWithCallback<string>(resolve => showPopup.call(
        tg,
        { ...params, buttons: params.buttons ?? [{ type: 'ok' }] },
        buttonId => resolve(buttonId || 'ok'),
      ))
    },
    showConfirm(message) {
      const showConfirm = tg.showConfirm
      if (typeof showConfirm !== 'function') return null
      return callWithCallback<boolean>(resolve => showConfirm.call(tg, message, confirmed => resolve(confirmed)))
    },

    async downloadFile(url, fileName) {
      const downloadFile = tg.downloadFile
      if (typeof downloadFile !== 'function') return 'unsupported'
      try {
        // An unsupported client throws instead of answering false.
        return await waitForSdkStatus<DownloadStatus>('cancelled', (settle) => {
          downloadFile.call(tg, { url, file_name: fileName }, accepted => settle(accepted ? 'downloading' : 'cancelled'))
        })
      }
      catch {
        return 'unsupported'
      }
    },
    canSharePreparedMessage: () => typeof tg.shareMessage === 'function',
    async sharePreparedMessage(messageId) {
      const shareMessage = tg.shareMessage
      if (typeof shareMessage !== 'function') return 'unsupported'
      try {
        return await waitForSdkStatus<ShareStatus>('cancelled', (settle) => {
          shareMessage.call(tg, messageId, sent => settle(sent ? 'shared' : 'cancelled'))
        })
      }
      catch {
        return 'unsupported'
      }
    },
    canRequestWriteAccess: () => typeof tg.requestWriteAccess === 'function',
    requestWriteAccess() {
      const requestWriteAccess = tg.requestWriteAccess
      if (typeof requestWriteAccess !== 'function') return Promise.resolve(false)
      return callWithCallback<boolean>(resolve => requestWriteAccess.call(tg, granted => resolve(granted)))
        ?? Promise.resolve(false)
    },
  }
}
