import { computed, readonly } from 'vue'
import { useRuntimeConfig } from '#imports'
import { client, colorScheme, currentSdk, initData, launch, sdkMissing, startParam } from '../client/state'
import type { MiniAppSdk } from '../types'

/**
 * The mini app the page runs in. Safe anywhere: in setup, in plugins, in a
 * handler after `await`, outside components — it reads module state, not the
 * Nuxt instance. On the server and before the plugin it is the website.
 *
 * Don't branch server-rendered markup on `client`: the server always renders
 * the website. Use the `mini-app-telegram` / `mini-app-max` class on <html>
 * (set before the first paint) or branch after mount.
 */
export function useMiniApp() {
  return {
    /** Where the app runs. Stays `telegram` / `max` when that SDK did not load. */
    client: readonly(client),
    isMiniApp: computed(() => client.value !== 'web'),
    colorScheme: readonly(colorScheme),
    /** Raw init data for your API; empty on the website. */
    initData: readonly(initData),
    /** Parsed init data: user, start parameter, chat. Not verified — trust only what your server checked. */
    launch: readonly(launch),
    /**
     * The start parameter to act on (`?startapp=…`), or null. Set only the
     * first time a tab sees it: after a reload of the same launch it is null,
     * so the app does not send the user back to the page of the link.
     * The parameter itself, always: `launch.value?.startParam`.
     */
    startParam: readonly(startParam),
    /** Opened in a messenger whose SDK did not load (no network): the app runs as the website. */
    sdkMissing: readonly(sdkMissing),

    /** The SDK of the client; the website's when there is none. Narrow by `sdk.client` for `raw`. */
    get sdk(): MiniAppSdk {
      return currentSdk()
    },

    /** The header your server reads with `requireMiniAppInitData`; empty on the website. */
    initDataHeaders(): Record<string, string> {
      const current = client.value
      if (current === 'web' || !initData.value) return {}
      const names = useRuntimeConfig().public.miniApps.initDataHeaders
      return { [names[current]]: initData.value }
    },

    /** Hides the messenger's loader. Called for you unless `autoReady: false`. */
    ready(): void {
      currentSdk().ready()
    },
  }
}
