import { useEffect, useRef } from 'react'

/**
 * Space, pressed while nothing in particular has focus.
 *
 * Anything focused keeps its own Space: a button presses, a field types, the
 * palette searches. Only Space on the bare page is free to start a game, so
 * the game can never take a keystroke that meant something else.
 */
export function useSpaceToPlay(onSpace: () => void): void {
  const latest = useRef(onSpace)

  latest.current = onSpace

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== ' ' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const focused = document.activeElement

      if (focused !== null && focused !== document.body) {
        return
      }

      event.preventDefault()
      latest.current()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
