import { watch } from 'vue'
import type { NuxtApp, Plugin } from '#app'
import { defineNuxtPlugin, useRuntimeConfig } from '#imports'
import type { MaxWebApp, MessengerClient, MiniAppSdk, TelegramWebApp } from './types'
import { createMaxSdk } from './client/adapters/max'
import { createTelegramSdk } from './client/adapters/telegram'
import { createWebSdk } from './client/adapters/web'
import {
  captureLaunchHash,
  claimStartParam,
  clearLaunchHash,
  detectClient,
  hasLaunchInitData,
  isLaunchHash,
  launchHashParam,
  resolveInitData,
  waitForLaunchInitData,
} from './client/launch'
import { loadSdk } from './client/sdk'
import { colorScheme, initDataHeaderNames, launch, sdkMissing, setMiniApp, startParam } from './client/state'
import { localSet } from './client/storage'

/** How long to wait for init data in the hash when the SDK came without it (iOS sets it late). */
const LATE_HASH_TIMEOUT_MS = 700

/*
 * Everything the app needs is ready when this plugin returns: it runs before
 * the app's own plugins and before the first navigation, so plugins and route
 * middleware read `useMiniApp()` as final. That is also why the outcome is
 * state (`startParam`, `sdkMissing`) and not runtime hooks: the app's plugins
 * would register their handlers after the hooks were called.
 */
const plugin: Plugin = defineNuxtPlugin({
  name: 'nuxt-miniapp-telegram-max',
  async setup(nuxtApp) {
    const options = useRuntimeConfig().public.miniApps
    Object.assign(initDataHeaderNames, options.initDataHeaders)
    const client = detectClient()

    if (client === 'web') {
      setMiniApp(createWebSdk(), 'web', '')
      syncColorSchemeAttribute(options.colorSchemeAttribute, false)
      return
    }

    captureLaunchHash()
    const raw = await loadSdk(client, options[client].sdkUrl, options.sdkTimeout)

    if (raw) {
      if (!raw.initData && !hasLaunchInitData(client)) {
        await waitForLaunchInitData(client, LATE_HASH_TIMEOUT_MS)
      }
      const sdk = createSdk(client, raw)
      setMiniApp(sdk, client, resolveInitData(client, raw.initData))
      syncColorSchemeAttribute(options.colorSchemeAttribute, true)

      if (options.expand) sdk.expand()
      if (!options.verticalSwipes) sdk.setVerticalSwipes(false)
      if (options.autoReady) nuxtApp.hooks.hookOnce('app:suspense:resolve', () => sdk.ready())
    }
    else {
      // Opened in the messenger, but its SDK did not come: no network, a
      // blocked CDN. The app goes on as the website; init data, if the tab
      // has it, still signs requests, and the start parameter still counts.
      setMiniApp(createWebSdk(), client, resolveInitData(client, null))
      sdkMissing.value = true
    }

    const param = launch.value?.startParam
      ?? raw?.initDataUnsafe?.start_param
      ?? launchHashParam(client, 'startParam')
    if (param && claimStartParam(param, launch.value?.hash ?? '')) startParam.value = param

    // After mount: the router's first navigation restores the URL it started with.
    if (options.cleanLaunchHash) nuxtApp.hooks.hookOnce('app:mounted', () => removeLaunchHash(nuxtApp))
  },
})

export default plugin

/**
 * Through the router where there is one: clearing only the address bar would
 * leave init data in the route (`fullPath`), for analytics to send away and
 * for the next `router.replace({ query })` to put back. A string location, so
 * it suits both vue-router and Nuxt's own router of apps without pages.
 */
function removeLaunchHash(nuxtApp: NuxtApp): void {
  const router: NuxtApp['$router'] | undefined = nuxtApp.$router
  const route = router?.currentRoute.value
  if (!router || !route || !isLaunchHash(route.hash)) return clearLaunchHash()
  Promise.resolve(router.replace(route.fullPath.slice(0, route.fullPath.indexOf('#')))).catch(() => {})
}

function createSdk(client: MessengerClient, raw: TelegramWebApp | MaxWebApp): MiniAppSdk {
  const platform = launchHashParam(client, 'platform')
  return client === 'telegram'
    ? createTelegramSdk(raw as TelegramWebApp, platform)
    : createMaxSdk(raw as MaxWebApp, platform)
}

/** Mirrors the color scheme into an attribute on <html>; in a mini app also remembers it for the next launch. */
function syncColorSchemeAttribute(attribute: string, remember: boolean): void {
  if (!attribute) return
  const apply = (scheme: string) => {
    document.documentElement.setAttribute(attribute, scheme)
    if (remember) localSet('color-scheme', scheme)
  }
  apply(colorScheme.value)
  watch(colorScheme, apply)
}
