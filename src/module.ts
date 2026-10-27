import { addImports, addPlugin, addServerImports, createResolver, defineNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { earlyDetect, STORAGE_PREFIX } from './early'
import type { EarlyDetectOptions } from './early'

export type * from './runtime/types'
export type { InitDataFailure, InitDataValidation, ValidateInitDataOptions } from './runtime/shared/validate'
export type { MiniAppRequest, RequireMiniAppInitDataOptions } from './runtime/server/utils/initData'

export interface ModuleOptions {
  telegram: {
    /** telegram-web-app.js. Point it at your own copy where telegram.org is slow to reach. */
    sdkUrl: string
  }
  max: {
    sdkUrl: string
  }
  /** How long to wait for the SDK script, ms. */
  sdkTimeout: number
  /**
   * An inline script in <head> marks <html> with `mini-app-telegram` /
   * `mini-app-max` before the first paint and keeps the launch hash. Turn off
   * under a CSP without inline scripts — detection then happens in the plugin.
   */
  earlyDetect: boolean
  /** Call the messenger's `ready()` once the app is hydrated. Turn off to call `useMiniApp().ready()` yourself. */
  autoReady: boolean
  /** Remove launch parameters from the address bar once read. */
  cleanLaunchHash: boolean
  /** Open Telegram mini apps at full height. */
  expand: boolean
  /** Swipe down closes the app. Turn off when the page has its own vertical gestures. */
  verticalSwipes: boolean
  /** Set the color scheme as this attribute on <html> (e.g. `data-color-scheme`); empty to leave <html> alone. */
  colorSchemeAttribute: string
  /** Header names for init data, shared by `useMiniApp().initDataHeaders()` and `requireMiniAppInitData()`. */
  initDataHeaders: {
    telegram: string
    max: string
  }
}

const CLASS_PREFIX = 'mini-app-'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'nuxt-miniapp-telegram-max',
    configKey: 'miniApps',
    compatibility: { nuxt: '>=4.0.0' },
  },
  defaults: {
    telegram: { sdkUrl: 'https://telegram.org/js/telegram-web-app.js' },
    max: { sdkUrl: 'https://st.max.ru/js/max-web-app.js' },
    sdkTimeout: 5_000,
    earlyDetect: true,
    autoReady: true,
    cleanLaunchHash: true,
    expand: false,
    verticalSwipes: true,
    colorSchemeAttribute: '',
    initDataHeaders: {
      telegram: 'X-Telegram-Init-Data',
      max: 'X-Max-Init-Data',
    },
  },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)

    nuxt.options.runtimeConfig.public.miniApps = defu(nuxt.options.runtimeConfig.public.miniApps, {
      telegram: options.telegram,
      max: options.max,
      sdkTimeout: options.sdkTimeout,
      autoReady: options.autoReady,
      cleanLaunchHash: options.cleanLaunchHash,
      expand: options.expand,
      verticalSwipes: options.verticalSwipes,
      colorSchemeAttribute: options.colorSchemeAttribute,
      initDataHeaders: options.initDataHeaders,
    })
    // Bot tokens are server-only: NUXT_MINI_APPS_TELEGRAM_BOT_TOKEN, NUXT_MINI_APPS_MAX_BOT_TOKEN.
    nuxt.options.runtimeConfig.miniApps = defu(nuxt.options.runtimeConfig.miniApps, {
      telegramBotToken: '',
      maxBotToken: '',
    })

    if (options.earlyDetect) {
      const early: EarlyDetectOptions = {
        prefix: STORAGE_PREFIX,
        classPrefix: CLASS_PREFIX,
        attribute: options.colorSchemeAttribute,
      }
      nuxt.options.app.head.script ||= []
      nuxt.options.app.head.script.push({
        key: 'nuxt-miniapp-telegram-max',
        innerHTML: `(${earlyDetect.toString()})(${JSON.stringify(early)})`,
        tagPriority: 'critical',
      })
    }

    addPlugin({ src: resolver.resolve('./runtime/plugin.client'), mode: 'client' })

    addImports(['useMiniApp', 'useMiniAppBackButton', 'useMiniAppHaptics', 'useMiniAppClosingConfirmation'].map(name => ({
      name,
      from: resolver.resolve(`./runtime/composables/${name}`),
    })))
    addServerImports(['validateInitData', 'requireMiniAppInitData', 'parseInitData'].map(name => ({
      name,
      from: resolver.resolve('./runtime/server/utils/initData'),
    })))
  },
})
