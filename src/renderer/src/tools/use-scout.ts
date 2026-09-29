import { useCallback, useEffect, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { ScoutIndex } from '../../../shared/tools'
import { useExecStream } from './use-exec-stream'

export type ScoutState = ReturnType<typeof useScout>

/** How far apart the two counts may be before the row is called out. */
export function drift(row: ScoutIndex): number | null {
  return row.db === null || row.indexed === null ? null : row.indexed - row.db
}

export function useScout(container: TinkerContainer | null, tenants: string[]) {
  const [tenant, setTenant] = useState('')
  /** Until you pick one yourself, the panel is free to choose a better default. */
  const [chosen, setChosen] = useState(false)
  const [rows, setRows] = useState<ScoutIndex[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  /** The model a reimport has been asked for but not yet confirmed. */
  const [armed, setArmed] = useState<string | null>(null)
  const stream = useExecStream()

  /*
   * Central is the wrong place to land. Under multi-database tenancy the
   * searchable models live in tenant databases, so checking the central
   * connection reports ten missing tables and nothing else — which reads as
   * the page being broken rather than as the wrong connection being asked.
   */
  useEffect(() => {
    if (!chosen && tenant === '' && tenants.length > 0) {
      setTenant(tenants[0] as string)
    }
  }, [chosen, tenant, tenants])

  const check = useCallback(async () => {
    if (container === null) {
      return
    }

    setLoading(true)

    try {
      setRows(await window.ray.getScoutIndexes(container.id, container.workingDir, tenant))
      setChecked(true)
    } finally {
      setLoading(false)
    }
  }, [container, tenant])

  /**
   * Reimporting goes through `tenants:run`, because the index the model writes
   * to is decided by the tenant that is active while it runs.
   */
  const reimport = useCallback(
    (model: string) => {
      if (container === null) {
        return
      }

      if (armed !== model) {
        setArmed(model)

        return
      }

      setArmed(null)

      const base = [
        'exec',
        '-i',
        '-w',
        container.workingDir || '/var/www/html',
        container.id,
        'php',
        'artisan',
      ]

      void stream.start(
        tenant === ''
          ? [...base, 'scout:import', model, '--no-interaction', '--ansi']
          : [
              ...base,
              'tenants:run',
              'scout:import',
              `--tenants=${tenant}`,
              `--argument=model=${model}`,
              '--no-interaction',
              '--ansi',
            ],
      )
    },
    [container, tenant, armed, stream],
  )

  return {
    tenant,
    setTenant: useCallback((next: string) => {
      setChosen(true)
      setTenant(next)
      setRows([])
      setChecked(false)
    }, []),
    rows,
    loading,
    checked,
    armed,
    disarm: useCallback(() => setArmed(null), []),
    check,
    reimport,
    stream,
  }
}
