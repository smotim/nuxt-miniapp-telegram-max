import { shallowRef } from 'vue'
import { parseInitData } from '../shared/initData'
import type { ColorScheme, MiniAppClient, MiniAppInitData, MiniAppSdk } from '../types'
import { createWebSdk } from './adapters/web'

/*
 * Module variables, not useState, for two reasons:
 * - the SDK is called from handlers after an `await`, where useState throws
 *   «nuxt instance unavailable»;
 * - inside useState Vue made the raw SDK reactive and every deep traversal
 *   threw on its read-only properties («'get' on proxy: property 'BackButton'…»).
 * Only the client plugin writes here. On the server they keep their initial
 * values (the website) and are shared by requests harmlessly: nothing writes.
 */
let sdk: MiniAppSdk = createWebSdk()

export const client = shallowRef<MiniAppClient>('web')
export const colorScheme = shallowRef<ColorScheme>('light')
export const initData = shallowRef('')
export const launch = shallowRef<MiniAppInitData | null>(null)
export const startParam = shallowRef<string | null>(null)
export const sdkMissing = shallowRef(false)

let stopColorScheme: () => void = () => {}

export function currentSdk(): MiniAppSdk {
  return sdk
}

/**
 * `clientValue` is where the app runs; it differs from `next.client` when a
 * messenger's SDK did not come and the app goes on with the website's adapter.
 */
export function setMiniApp(next: MiniAppSdk, clientValue: MiniAppClient, rawInitData: string): void {
  sdk = next
  client.value = clientValue
  initData.value = rawInitData
  launch.value = rawInitData ? parseInitData(rawInitData) : null

  stopColorScheme()
  colorScheme.value = next.colorScheme
  stopColorScheme = next.onColorSchemeChange((scheme) => {
    colorScheme.value = scheme
  })
}
