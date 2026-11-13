import { useEffect, useRef } from 'react'

/** Keys that move focus, after which a clicked button is no longer the reason it is focused. */
const NAVIGATION = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

/**
 * The button the last pointer press landed on, for as long as the keyboard
 * has not moved focus since. Read through the returned getter, so it is
 * current at the moment a key arrives.
 */
export function useClickedButton(): () => Element | null {
  const clicked = useRef<Element | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      clicked.current = event.target instanceof Element ? event.target.closest('button') : null
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (NAVIGATION.has(event.key)) {
        clicked.current = null
      }
    }

    // Capture, so a handler that stops propagation cannot hide either one.
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [])

  return () => clicked.current
}
