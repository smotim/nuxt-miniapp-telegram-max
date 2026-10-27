import MiniApps from '../../../src/module'

export default defineNuxtConfig({
  modules: [MiniApps],
  runtimeConfig: {
    miniApps: {
      telegramBotToken: '1:telegram-test-token',
      maxBotToken: '2:max-test-token',
    },
  },
  compatibilityDate: 'latest',
  miniApps: {
    telegram: { sdkUrl: '/fake-telegram.js' },
    max: { sdkUrl: '/fake-max.js' },
    sdkTimeout: 2_000,
    colorSchemeAttribute: 'data-color-scheme',
  },
})
