import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { createTelegramSdk } from '../../src/runtime/client/adapters/telegram'
import { createWebSdk } from '../../src/runtime/client/adapters/web'
import { setMiniApp } from '../../src/runtime/client/state'
import { useMiniAppBackButton } from '../../src/runtime/composables/useMiniAppBackButton'
import { useMiniAppClosingConfirmation } from '../../src/runtime/composables/useMiniAppClosingConfirmation'

function fakeTelegram() {
  const button = { visible: false, handler: null as (() => void) | null }
  const sdk = createTelegramSdk({
    initData: '',
    BackButton: {
      show: () => {
        button.visible = true
      },
      hide: () => {
        button.visible = false
      },
      onClick: (callback) => {
        button.handler = callback
      },
      offClick: () => {
        button.handler = null
      },
    },
  }, null)
  return { sdk, button }
}

function mount(setup: () => void) {
  const app = createApp(defineComponent({ setup: () => {
    setup()
    return () => h('div')
  } }))
  app.mount(document.createElement('div'))
  return app
}

afterEach(() => setMiniApp(createWebSdk(), 'web', ''))

describe('useMiniAppBackButton', () => {
  it('holds the button while mounted and enabled', async () => {
    const { sdk, button } = fakeTelegram()
    setMiniApp(sdk, 'telegram', '')
    const enabled = ref(false)
    let pressed = 0

    const app = mount(() => useMiniAppBackButton(() => pressed++, { enabled }))
    expect(button.visible).toBe(false)

    enabled.value = true
    await nextTick()
    button.handler?.()
    expect(button.visible).toBe(true)
    expect(pressed).toBe(1)

    app.unmount()
    expect(button.visible).toBe(false)
  })

  it('lets go of the button while its page is kept alive but hidden', async () => {
    const { sdk, button } = fakeTelegram()
    setMiniApp(sdk, 'telegram', '')
    const Page = defineComponent({ setup: () => {
      useMiniAppBackButton(() => {})
      return () => h('div')
    } })
    const Other = defineComponent({ render: () => h('div') })
    const showPage = ref(true)

    const app = createApp({ render: () => h(KeepAlive, null, [showPage.value ? h(Page) : h(Other)]) })
    app.mount(document.createElement('div'))
    expect(button.visible).toBe(true)

    showPage.value = false
    await nextTick()
    expect(button.visible).toBe(false)

    showPage.value = true
    await nextTick()
    expect(button.visible).toBe(true)
    app.unmount()
  })
})

describe('useMiniAppClosingConfirmation', () => {
  it('stays on while any component still asks for it', async () => {
    const calls: boolean[] = []
    setMiniApp(createTelegramSdk({
      initData: '',
      enableClosingConfirmation: () => calls.push(true),
      disableClosingConfirmation: () => calls.push(false),
    }, null), 'telegram', '')

    const form = mount(() => useMiniAppClosingConfirmation(true))
    const payment = mount(() => useMiniAppClosingConfirmation(true))
    form.unmount()
    expect(calls).toEqual([true])

    payment.unmount()
    expect(calls).toEqual([true, false])
  })
})
