import { useEffect, useState } from 'react'

/** macOS hides the traffic lights in full screen, so their gutter can go too. */
export function useFullScreen(): boolean {
  const [fullScreen, setFullScreen] = useState(false)

  useEffect(() => window.ray.onFullScreen(setFullScreen), [])

  return fullScreen
}
