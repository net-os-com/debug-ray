import { useEffect, useState } from 'react'
import type { UpdateStatus } from '../../shared/ray-event'

const IDLE: UpdateStatus = { phase: 'idle', version: null, percent: 0, error: null }

/**
 * Mirrors the main process' view of a pending update. The status is also read
 * once on mount, because the check runs as the window appears and may well have
 * answered before this ever subscribed.
 */
export function useUpdate(): UpdateStatus {
  const [status, setStatus] = useState<UpdateStatus>(IDLE)

  useEffect(() => {
    void window.ray.getUpdateStatus().then(setStatus)

    return window.ray.onUpdate(setStatus)
  }, [])

  return status
}
