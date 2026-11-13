import { useEffect, useRef } from 'react'
import type { WindowIntent } from '../../shared/window-intent'

type Handlers = {
  onSelectEvent: (id: string) => void
  onShowView: (view: 'settings') => void
}

/**
 * Applies what the main process asks of this window when it brings it forward.
 *
 * First whatever was waiting while the window was still being built, then each
 * intent as it comes. Taking the waiting one is also what tells the main
 * process this window is listening, so the order of the two calls matters
 * less than that both happen once, on mount.
 */
export function useWindowIntents(handlers: Handlers): void {
  const latest = useRef(handlers)

  latest.current = handlers

  useEffect(() => {
    const apply = (intent: WindowIntent): void => {
      if (intent.kind === 'select-event') {
        latest.current.onSelectEvent(intent.id)
      } else {
        latest.current.onShowView(intent.view)
      }
    }

    const unsubscribe = window.ray.onIntent(apply)

    void window.ray.takeIntent().then((intent) => {
      if (intent) {
        apply(intent)
      }
    })

    return unsubscribe
  }, [])
}
