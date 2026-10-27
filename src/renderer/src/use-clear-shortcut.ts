import { useEffect, useRef } from 'react'

/**
 * Cmd-K empties the stream, the way it does in Ray itself.
 *
 * It works from anywhere rather than only on the Stream view: the gesture is
 * "start from nothing", and reaching for it usually means something is about
 * to be reproduced — often from another tab, with the stream waiting behind it.
 *
 * It does not fire while a field has focus. Cmd-K is a text shortcut in enough
 * places that clearing the buffer out from under somebody mid-sentence would be
 * a surprise, and the palette and the filter boxes are exactly where a hand
 * already is.
 */
export function useClearShortcut(clear: () => void): void {
  const latest = useRef(clear)

  latest.current = clear

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') {
        return
      }

      const focused = document.activeElement

      if (
        focused instanceof HTMLInputElement ||
        focused instanceof HTMLTextAreaElement ||
        (focused instanceof HTMLElement && focused.isContentEditable)
      ) {
        return
      }

      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
