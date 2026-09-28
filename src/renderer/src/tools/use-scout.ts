import { useCallback, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { ScoutIndex } from '../../../shared/tools'
import { useExecStream } from './use-exec-stream'

export type ScoutState = ReturnType<typeof useScout>

/** How far apart the two counts may be before the row is called out. */
export function drift(row: ScoutIndex): number | null {
  return row.db === null || row.indexed === null ? null : row.indexed - row.db
}

export function useScout(container: TinkerContainer | null) {
  const [tenant, setTenant] = useState('')
  const [rows, setRows] = useState<ScoutIndex[]>([])
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  /** The model a reimport has been asked for but not yet confirmed. */
  const [armed, setArmed] = useState<string | null>(null)
  const stream = useExecStream()

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
