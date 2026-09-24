import { useEffect } from 'react'

/**
 * The setting lives in the renderer's storage, so the window is told on mount
 * as well as on every change — otherwise a restart would silently drop it.
 */
export function useAlwaysOnTop(onTop: boolean): void {
  useEffect(() => {
    window.ray.setAlwaysOnTop(onTop)
  }, [onTop])
}
