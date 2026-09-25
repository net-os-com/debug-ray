import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TinkerContainer, TinkerOutcome } from '../../../shared/tinker'
import { branchPaths } from './value-tree'

/** Everything the Tinker view needs, owned in App so a run outlives a view switch. */
export type TinkerState = ReturnType<typeof useTinker>

export function useTinker() {
  const [containers, setContainers] = useState<TinkerContainer[]>([])
  const [containerId, setContainerId] = useState<string | null>(null)
  const [tenants, setTenants] = useState<string[]>([])
  const [tenant, setTenant] = useState('')
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<TinkerOutcome | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    void window.ray
      .getContainers()
      .then((found) => {
        setContainers(found)
        setContainerId((current) => current ?? found.find((one) => one.running)?.id ?? null)
      })
      .catch((error: Error) => setProblem(error.message))
  }, [])

  const container = useMemo(
    () => containers.find((one) => one.id === containerId) ?? null,
    [containers, containerId],
  )

  // Tenants live in the application, so they can only be read once a container
  // is chosen — and the answer costs a framework boot, hence the cache in main.
  useEffect(() => {
    if (container === null || !container.running) {
      setTenants([])

      return
    }

    let cancelled = false

    void window.ray
      .getTenants(container.id, container.workingDir)
      .then((found) => {
        if (!cancelled) {
          setTenants(found)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [container])

  const run = useCallback(
    async (code: string) => {
      if (container === null || running) {
        return
      }

      setRunning(true)

      try {
        const next = await window.ray.runTinker({
          containerId: container.id,
          workingDir: container.workingDir,
          tenant,
          code,
        })

        setOutcome(next)
        setCollapsed(new Set())
      } finally {
        setRunning(false)
      }
    },
    [container, running, tenant],
  )

  const toggle = useCallback((path: string) => {
    setCollapsed((current) => {
      const next = new Set(current)

      if (!next.delete(path)) {
        next.add(path)
      }

      return next
    })
  }, [])

  const collapseAll = useCallback(() => {
    if (outcome?.kind !== 'value') {
      return
    }

    setCollapsed(new Set(branchPaths(outcome.value).filter((path) => path !== 'root')))
  }, [outcome])

  return {
    containers,
    container,
    selectContainer: setContainerId,
    tenants,
    tenant,
    setTenant,
    running,
    outcome,
    problem,
    collapsed,
    toggle,
    expandAll: useCallback(() => setCollapsed(new Set()), []),
    collapseAll,
    clear: useCallback(() => setOutcome(null), []),
    run,
  }
}
