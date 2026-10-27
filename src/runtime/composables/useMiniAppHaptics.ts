import { currentSdk } from '../client/state'
import type { HapticImpactStyle, HapticNotificationType } from '../types'

/** Haptic feedback of the mini app; does nothing on the website. Safe to call anywhere. */
export function useMiniAppHaptics() {
  return {
    get supported(): boolean {
      return currentSdk().haptics.supported
    },
    impact: (style: HapticImpactStyle = 'light') => currentSdk().haptics.impact(style),
    notification: (type: HapticNotificationType) => currentSdk().haptics.notification(type),
    selection: () => currentSdk().haptics.selection(),
  }
}
