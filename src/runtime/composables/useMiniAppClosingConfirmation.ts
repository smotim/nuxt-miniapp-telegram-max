import { onScopeDispose, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { currentSdk } from '../client/state'

/** Components asking for the confirmation now: it stays on while any of them does. */
let requests = 0

function request(delta: 1 | -1): void {
  const before = requests
  requests += delta
  if ((before === 0) !== (requests === 0)) currentSdk().setClosingConfirmation(requests > 0)
}

/**
 * Asks before the mini app closes while `enabled` is true — an unsaved form,
 * a payment in progress. Several components may ask at once; it turns off when
 * the last one stops or unmounts. The website has no such prompt (use
 * `beforeunload` there if needed).
 */
export function useMiniAppClosingConfirmation(enabled: MaybeRefOrGetter<boolean>): void {
  if (import.meta.server) return

  let active = false
  const set = (value: boolean) => {
    if (value === active) return
    active = value
    request(value ? 1 : -1)
  }

  watch(() => toValue(enabled), set, { immediate: true })
  onScopeDispose(() => set(false))
}
