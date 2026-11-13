import { useEffect, useRef } from 'react'
import { spaceIsFree } from './space-is-free'

/**
 * Space, pressed while nothing in particular has focus and nothing is open
 * over the stream.
 *
 * Whatever is focused keeps its own Space — see `spaceIsFree`. And
 * `enabled` says what focus cannot: the palette or a modal may be open with
 * its input blurred by a click on its own padding, and Space there must not
 * start a game behind it. So the game can never take a keystroke that meant
 * something else.
 */
export function useSpaceToPlay(
  onSpace: () => void,
  enabled: boolean,
  clicked: () => Element | null,
): void {
  const latest = useRef({ onSpace, enabled, clicked })

  latest.current = { onSpace, enabled, clicked }

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!latest.current.enabled) {
        return
      }

      if (event.key !== ' ' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      if (!spaceIsFree(document.activeElement, document.body, latest.current.clicked())) {
        return
      }

      // Also keeps a clicked button from pressing again on the key's release.
      event.preventDefault()
      latest.current.onSpace()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
