import { onActivated, onBeforeUnmount, onDeactivated, onMounted, toValue, watch } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { currentSdk } from '../client/state'

export interface MiniAppBackButtonOptions {
  /** Show the button only while true; a modal passes its `open` state. Default: always. */
  enabled?: MaybeRefOrGetter<boolean>
}

/**
 * Shows the messenger's back button while the component is on screen, with
 * `handler` on press. Layers stack: a modal over a page takes the button and
 * gives it back on close. A page kept alive by `<KeepAlive>` lets go of it
 * while hidden. On the website it does nothing — draw your own.
 */
export function useMiniAppBackButton(handler: () => void, options: MiniAppBackButtonOptions = {}): void {
  let release: (() => void) | undefined
  let visible = false
  const enabled = () => toValue(options.enabled ?? true)

  function sync() {
    if (visible && enabled() && !release) {
      release = currentSdk().pushBackButton(() => handler())
    }
    else if ((!visible || !enabled()) && release) {
      release()
      release = undefined
    }
  }

  const show = (value: boolean) => {
    visible = value
    sync()
  }

  watch(enabled, sync)
  onMounted(() => show(true))
  onActivated(() => show(true))
  onDeactivated(() => show(false))
  onBeforeUnmount(() => show(false))
}
