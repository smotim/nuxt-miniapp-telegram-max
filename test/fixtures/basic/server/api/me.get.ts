export default defineEventHandler(async (event) => {
  const { client, data } = await requireMiniAppInitData(event)
  return { client, name: data.user?.first_name }
})
