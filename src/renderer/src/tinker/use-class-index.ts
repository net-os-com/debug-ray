import { useEffect, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import { buildIndex, type ClassIndex } from './rank-classes'

/**
 * Loads the container's class list once and keeps the searchable form of it.
 *
 * Sixteen thousand names is about three quarters of a megabyte over IPC, which
 * is worth paying once and never again — the main process caches the scan, so
 * switching back to a container you have used is instant.
 */
export function useClassIndex(container: TinkerContainer | null): ClassIndex {
  const [index, setIndex] = useState<ClassIndex>([])

  useEffect(() => {
    if (container === null || !container.running) {
      setIndex([])

      return
    }

    let cancelled = false

    void window.ray
      .getClasses(container.id, container.workingDir)
      .then((classes) => {
        if (!cancelled) {
          setIndex(buildIndex(classes))
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [container])

  return index
}
