import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TinkerContainer, TinkerOutcome } from '../../../shared/tinker'
import { branchPaths } from './value-tree'

/** Everything the Tinker view needs, owned in App so a run outlives a view switch. */
export type TinkerState = ReturnType<typeof useTinker>

export function useTinker(pinned: string) {
  const [containers, setContainers] = useState<TinkerContainer[]>([])
  /** Whether Docker has answered yet; an empty list means both "none" and "not asked". */
  const [containersRead, setContainersRead] = useState(false)
  const [containerId, setContainerId] = useState<string | null>(null)
  const [tenants, setTenants] = useState<string[]>([])
  const [tenant, setTenant] = useState('')
  const [running, setRunning] = useState(false)
  const [outcome, setOutcome] = useState<TinkerOutcome | null>(null)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [search, setSearch] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  /**
   * The setting as it stood when the selection was last made from it.
   *
   * Changing the setting has to override whatever is selected — otherwise
   * choosing a container in Settings does nothing until a restart, which is
   * the opposite of what the control says. A refresh of the list with the same
   * setting must not, or it would undo a pick made in the view's own picker.
   */
  const applied = useRef<string | null>(null)

  useEffect(() => {
    const changed = applied.current !== pinned

    applied.current = pinned

    void window.ray
      .getContainers()
      .then((found) => {
        setContainers(found)
        setContainerId((current) => (changed ? choose(found, pinned) : (current ?? choose(found, pinned))))
      })
      .catch((error: Error) => setProblem(error.message))
      .finally(() => setContainersRead(true))
  }, [pinned])

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
    containersRead,
    container,
    selectContainer: setContainerId,
    selectContainerByName: useCallback(
      (name: string) => {
        const match = containers.find((one) => one.name === name)

        if (match !== undefined) {
          setContainerId(match.id)
        }
      },
      [containers],
    ),
    tenants,
    tenant,
    setTenant,
    running,
    outcome,
    problem,
    collapsed,
    search,
    setSearch,
    toggle,
    expandAll: useCallback(() => setCollapsed(new Set()), []),
    collapseAll,
    clear: useCallback(() => setOutcome(null), []),
    run,
  }
}

/**
 * Which container to run in.
 *
 * The pinned name wins when Docker still knows it, and a stopped container with
 * that name is still the answer — the user chose it, and silently running
 * somewhere else is how a query lands in the wrong database. Otherwise the
 * first running container that holds a Laravel application, and only then any
 * running one at all.
 */
function choose(found: TinkerContainer[], pinned: string): string | null {
  if (pinned !== '') {
    const named = found.find((one) => one.name === pinned)

    if (named !== undefined) {
      return named.id
    }
  }

  return (
    found.find((one) => one.running && one.laravel === true)?.id ??
    found.find((one) => one.running)?.id ??
    null
  )
}
