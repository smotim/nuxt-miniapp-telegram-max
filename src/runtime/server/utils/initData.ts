import { createError, getHeader } from 'h3'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'
import { parseInitData } from '../../shared/initData'
import { validateInitData } from '../../shared/validate'
import type { MessengerClient, MiniAppInitData } from '../../types'

export { parseInitData, validateInitData }

export interface RequireMiniAppInitDataOptions {
  maxAge?: number | false
}

export interface MiniAppRequest {
  client: MessengerClient
  /** Raw init data, as received. */
  initData: string
  data: MiniAppInitData
}

/**
 * Reads init data from the request header (`X-Telegram-Init-Data` or
 * `X-Max-Init-Data` by default — the same names `useMiniApp().initDataHeaders()`
 * sends), checks it with the bot token from runtime config and returns it.
 * Answers 401 otherwise, with the reason in `data.reason`.
 */
export async function requireMiniAppInitData(
  event: H3Event,
  options: RequireMiniAppInitDataOptions = {},
): Promise<MiniAppRequest> {
  const config = useRuntimeConfig(event)
  const headers = config.public.miniApps.initDataHeaders
  const tokens = { telegram: config.miniApps.telegramBotToken, max: config.miniApps.maxBotToken }

  for (const client of ['telegram', 'max'] as const) {
    const initData = getHeader(event, headers[client])
    if (!initData) continue

    // A plain error: Nitro logs it and answers a bare 500, not telling the client about the config.
    if (!tokens[client]) throw new Error(`nuxt-miniapp-telegram-max: no ${client} bot token in runtime config`)

    const result = await validateInitData(initData, tokens[client], { maxAge: options.maxAge })
    if (!result.valid) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid mini app init data', data: { reason: result.reason } })
    }

    return { client, initData, data: result.data }
  }

  throw createError({ statusCode: 401, statusMessage: 'Mini app init data required', data: { reason: 'missing' } })
}
