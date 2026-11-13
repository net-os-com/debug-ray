import { useCallback, useEffect, useState } from 'react'
import type { PauseState } from '../../shared/pause-state'

const RUNNING: PauseState = { paused: false, since: null }

/**
 * The stream's pause, mirrored from the main process.
 *
 * Main owns it so the toolbar, the palette and the menu bar change one pause,
 * and so it survives the window being closed. Setting it here only asks main;
 * the change comes back over `onPause`, like everyone else's.
 */
export function useStreamPause(): PauseState & { setPaused: (paused: boolean) => void } {
  const [state, setState] = useState<PauseState>(RUNNING)

  useEffect(() => {
    void window.ray.getPause().then(setState)

    return window.ray.onPause(setState)
  }, [])

  const setPaused = useCallback((paused: boolean) => window.ray.setPaused(paused), [])

  return { ...state, setPaused }
}
