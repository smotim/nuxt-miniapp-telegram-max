interface BackButtonLike {
  show?(): void
  hide?(): void
  onClick?(callback: () => void): void
  offClick?(callback: () => void): void
}

/**
 * The messenger has one back button, and a page, a modal over it and a dialog
 * over the modal all want it. With a plain show/hide, closing the modal hid the
 * page's button while the page's handler stayed attached, and the next system
 * «back» closed the whole app. So the layers form a stack: the SDK sees the top
 * handler, a release brings back the one below, and the button hides only when
 * the stack is empty.
 */
export function createBackButtonStack(button: BackButtonLike | undefined) {
  const stack: Array<() => void> = []
  let attached: (() => void) | null = null

  function sync(): void {
    if (!button) return
    const top = stack.at(-1) ?? null
    if (top === attached) return

    try {
      if (attached) button.offClick?.(attached)
      attached = top
      if (top) {
        button.onClick?.(top)
        button.show?.()
      }
      else {
        button.hide?.()
      }
    }
    catch {
      // An old client without a working button: nothing to show.
    }
  }

  return {
    push(handler: () => void): () => void {
      if (!button) return () => {}

      // Each layer gets its own function, so the same handler pushed twice is two layers.
      const layer = () => handler()
      stack.push(layer)
      sync()

      let released = false
      return () => {
        if (released) return
        released = true
        // Layers are not always released top-down (a page may unmount after its modal).
        const index = stack.lastIndexOf(layer)
        if (index !== -1) stack.splice(index, 1)
        sync()
      }
    },
  }
}
