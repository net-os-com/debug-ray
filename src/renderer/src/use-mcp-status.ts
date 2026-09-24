import { useEffect, useState } from 'react'
import type { McpStatus } from '../../shared/ray-event'

/** The heartbeat window is 30s, so polling faster than this buys nothing. */
const POLL_MS = 3000

export function useMcpStatus(): McpStatus | null {
  const [status, setStatus] = useState<McpStatus | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = (): void => {
      void window.ray.getMcpStatus().then((next) => {
        if (!cancelled) {
          setStatus(next)
        }
      })
    }

    load()

    const timer = setInterval(load, POLL_MS)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  return status
}
