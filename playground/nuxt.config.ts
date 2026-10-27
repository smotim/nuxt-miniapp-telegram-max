export default defineNuxtConfig({
  modules: ['nuxt-miniapp-telegram-max'],
  devtools: { enabled: true },
  compatibilityDate: 'latest',
  miniApps: {
    expand: true,
    colorSchemeAttribute: 'data-color-scheme',
  },
})
