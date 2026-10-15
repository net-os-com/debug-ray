import { useEffect, useState } from 'react'
import { MODULES, type View } from '../chrome/view-nav'

/**
 * ⌘K opens the palette, Escape closes it, and ⌘1–6 jump straight to a module.
 *
 * The number keys are handled here rather than in the rail because they have to
 * work from anywhere, including with the palette open — and because the order
 * they follow is the order MODULES is written in, which is the same list the
 * rail draws from.
 */
export function usePalette(onSelectView: (view: View) => void) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const command = event.metaKey || event.ctrlKey

      if (command && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((shown) => !shown)

        return
      }

      if (event.key === 'Escape') {
        setOpen(false)

        return
      }

      if (command && /^[1-9]$/.test(event.key)) {
        const module = MODULES[Number(event.key) - 1]

        if (module !== undefined) {
          event.preventDefault()
          setOpen(false)
          onSelectView(module.key)
        }
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [onSelectView])

  return { open, show: () => setOpen(true), hide: () => setOpen(false) }
}
