import { useEffect, useRef } from 'react'

/**
 * Cmd-F focuses whichever search box belongs to what is on screen.
 *
 * The target is looked up by a `data-find` attribute rather than by passing
 * refs down: the boxes sit in four unrelated view trees, and threading a ref
 * through each of them to serve one keystroke would cost every component along
 * the way a prop it has no other use for.
 *
 * The caller decides what is current on each press, so the choice can depend on
 * state that changes between presses — the Tinker view has two boxes and picks
 * by whether there is any output to search.
 */
export function useFindShortcut(target: () => string | null): void {
  const latest = useRef(target)

  latest.current = target

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') {
        return
      }

      const selector = latest.current()

      if (selector === null) {
        return
      }

      const field = document.querySelector<HTMLInputElement>(selector)

      if (field === null) {
        return
      }

      event.preventDefault()
      field.focus()
      // Selecting what is there means the next keystroke replaces the old
      // query instead of extending it, which is what a second Cmd-F is for.
      field.select()
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
