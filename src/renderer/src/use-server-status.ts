import { useEffect, useState } from 'react'
import type { ServerStatus } from '../../shared/ray-event'

export function useServerStatus(): ServerStatus | null {
  const [status, setStatus] = useState<ServerStatus | null>(null)

  useEffect(() => {
    void window.ray.getStatus().then(setStatus)

    return window.ray.onStatus(setStatus)
  }, [])

  return status
}
