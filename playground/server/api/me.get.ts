// Bot tokens: NUXT_MINI_APPS_TELEGRAM_BOT_TOKEN, NUXT_MINI_APPS_MAX_BOT_TOKEN.
export default defineEventHandler(async (event) => {
  const { client, data } = await requireMiniAppInitData(event)
  return { client, user: data.user, authDate: data.authDate }
})
