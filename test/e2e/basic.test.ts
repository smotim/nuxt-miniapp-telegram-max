import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { $fetch, createPage, fetch, setup, url } from '@nuxt/test-utils/e2e'
import { signInitData, userFields } from '../signInitData'

const TELEGRAM_TOKEN = '1:telegram-test-token'
const MAX_TOKEN = '2:max-test-token'

function telegramLaunch(extra: Record<string, string> = {}) {
  const initData = signInitData(userFields({ id: 1, first_name: 'Ann' }, extra), TELEGRAM_TOKEN)
  return `/#tgWebAppData=${encodeURIComponent(initData)}&tgWebAppPlatform=ios&tgWebAppVersion=9.0`
}

function maxLaunch() {
  const initData = signInitData(userFields({ id: 2, first_name: 'Max' }, { start_param: 'venue_7' }), MAX_TOKEN)
  return `/#WebAppData=${encodeURIComponent(initData)}&WebAppPlatform=android`
}

async function text(page: Awaited<ReturnType<typeof createPage>>, test: string) {
  return (await page.locator(`[data-test="${test}"]`).textContent())?.trim()
}

describe('nuxt-miniapp-telegram-max', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('../fixtures/basic', import.meta.url)),
    browser: true,
  })

  it('renders the website on the server, with the early script and no SDK', async () => {
    const html = await $fetch<string>('/')
    expect(html).toContain('nuxt-miniapp:')
    expect(html).not.toMatch(/<script[^>]+fake-telegram\.js/)
  })

  it('stays the website without launch parameters and loads no SDK', async () => {
    const page = await createPage()
    const scripts: string[] = []
    page.on('request', request => scripts.push(request.url()))
    await page.goto(url('/'), { waitUntil: 'networkidle' })

    expect(await text(page, 'client')).toBe('web')
    expect(scripts.some(script => script.includes('fake-'))).toBe(false)
    expect(await page.evaluate(() => document.documentElement.className)).not.toContain('mini-app-')
  })

  it('starts in Telegram: user, start parameter, theme, ready, a clean address', async () => {
    const page = await createPage()
    await page.goto(url(telegramLaunch({ start_param: 'lecture_42' })), { waitUntil: 'networkidle' })

    expect(await text(page, 'client')).toBe('telegram')
    expect(await text(page, 'user')).toBe('Ann')
    expect(await text(page, 'start-param')).toBe('lecture_42')
    expect(await page.evaluate(() => document.documentElement.classList.contains('mini-app-telegram'))).toBe(true)
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-color-scheme'))).toBe('dark')
    expect(await page.evaluate(() => (window as unknown as { __sdkCalls: string[] }).__sdkCalls)).toContain('ready')
    // Gone from the route too, not only from the address bar: analytics read the route.
    await page.waitForFunction(() => document.querySelector('[data-test="route"]')?.textContent?.trim() === '/')
    expect(new URL(page.url()).hash).toBe('')
  })

  it('stays Telegram after a reload, without acting on the start parameter again', async () => {
    const page = await createPage()
    await page.goto(url(telegramLaunch({ start_param: 'lecture_42' })), { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })

    expect(await text(page, 'client')).toBe('telegram')
    expect(await text(page, 'user')).toBe('Ann')
    expect(await text(page, 'start-param')).toBe('')
  })

  it('signs requests, and the server checks the signature', async () => {
    const page = await createPage()
    await page.goto(url(telegramLaunch()), { waitUntil: 'networkidle' })
    await page.click('[data-test="check-server"]')
    await page.waitForFunction(() => document.querySelector('[data-test="server"]')?.textContent?.trim())

    expect(await text(page, 'server')).toBe('telegram:Ann')

    const forged = await fetch('/api/me', { headers: { 'X-Telegram-Init-Data': 'auth_date=1&user=%7B%7D&hash=00' } })
    expect(forged.status).toBe(401)
    expect((await fetch('/api/me')).status).toBe(401)
  })

  it('gives the back button to a modal and takes it back', async () => {
    const page = await createPage()
    await page.goto(url(telegramLaunch()), { waitUntil: 'networkidle' })
    await page.click('[data-test="open-modal"]')
    await page.waitForSelector('[data-test="modal"]')

    await page.evaluate(() => (window as unknown as { __pressBack: () => void }).__pressBack())
    await page.waitForSelector('[data-test="modal"]', { state: 'detached' })

    const calls = await page.evaluate(() => (window as unknown as { __sdkCalls: string[] }).__sdkCalls)
    expect(calls.filter(call => call.startsWith('back:'))).toEqual(['back:show', 'back:hide'])
  })

  it('starts in MAX', async () => {
    const page = await createPage()
    await page.goto(url(maxLaunch()), { waitUntil: 'networkidle' })

    expect(await text(page, 'client')).toBe('max')
    expect(await text(page, 'user')).toBe('Max')
    expect(await text(page, 'start-param')).toBe('venue_7')

    await page.click('[data-test="check-server"]')
    await page.waitForFunction(() => document.querySelector('[data-test="server"]')?.textContent?.trim())
    expect(await text(page, 'server')).toBe('max:Max')
  })

  it('goes on as the website when the SDK does not load, keeping init data and the start parameter', async () => {
    const page = await createPage()
    await page.route('**/fake-telegram.js', route => route.abort())
    await page.goto(url(telegramLaunch({ start_param: 'lecture_42' })), { waitUntil: 'networkidle' })

    expect(await text(page, 'client')).toBe('telegram')
    expect(await text(page, 'sdk-missing')).toBe('true')
    expect(await text(page, 'start-param')).toBe('lecture_42')
    expect(new URL(page.url()).hash).toBe('')

    await page.click('[data-test="check-server"]')
    await page.waitForFunction(() => document.querySelector('[data-test="server"]')?.textContent?.trim())
    expect(await text(page, 'server')).toBe('telegram:Ann')
  })
})
