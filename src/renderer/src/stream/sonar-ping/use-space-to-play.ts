import { useEffect, useRef } from 'react'

/**
 * Space, pressed while nothing in particular has focus and nothing is open
 * over the stream.
 *
 * Anything focused keeps its own Space: a button presses, a field types. And
 * `enabled` says what focus cannot: the palette or a modal may be open with
 * its input blurred by a click on its own padding, and Space there must not
 * start a game behind it. So the game can never take a keystroke that meant
 * something else.
 */
export function useSpaceToPlay(onSpace: () => void, enabled: boolean): void {
  const latest = useRef({ onSpace, enabled })

  latest.current = { onSpace, enabled }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!latest.current.enabled) {
        return
      }

      if (event.key !== ' ' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const focused = document.activeElement

      if (focused !== null && focused !== document.body) {
        return
      }

      event.preventDefault()
      latest.current.onSpace()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
