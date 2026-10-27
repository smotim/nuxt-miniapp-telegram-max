import { describe, expect, it } from 'vitest'
import { createBackButtonStack } from '../../src/runtime/client/backButton'

function fakeButton() {
  const button = {
    visible: false,
    handler: null as (() => void) | null,
    show: () => {
      button.visible = true
    },
    hide: () => {
      button.visible = false
    },
    onClick: (callback: () => void) => {
      button.handler = callback
    },
    offClick: (callback: () => void) => {
      if (button.handler === callback) button.handler = null
    },
    press: () => button.handler?.(),
  }
  return button
}

describe('createBackButtonStack', () => {
  it('gives the button to the top layer and back on release', () => {
    const button = fakeButton()
    const stack = createBackButtonStack(button)
    const pressed: string[] = []

    const releasePage = stack.push(() => pressed.push('page'))
    const releaseModal = stack.push(() => pressed.push('modal'))
    button.press()
    releaseModal()
    button.press()

    expect(pressed).toEqual(['modal', 'page'])
    expect(button.visible).toBe(true)

    releasePage()
    expect(button.visible).toBe(false)
    expect(button.handler).toBeNull()
  })

  it('keeps the top layer when one below is released first', () => {
    const button = fakeButton()
    const stack = createBackButtonStack(button)
    const pressed: string[] = []

    const releasePage = stack.push(() => pressed.push('page'))
    stack.push(() => pressed.push('modal'))
    releasePage()
    button.press()

    expect(pressed).toEqual(['modal'])
    expect(button.visible).toBe(true)
  })

  it('treats the same handler pushed twice as two layers, and a double release as one', () => {
    const button = fakeButton()
    const stack = createBackButtonStack(button)
    const handler = () => {}

    const first = stack.push(handler)
    stack.push(handler)
    first()
    first()

    expect(button.visible).toBe(true)
  })

  it('does nothing without a button', () => {
    expect(() => createBackButtonStack(undefined).push(() => {})()).not.toThrow()
  })
})
