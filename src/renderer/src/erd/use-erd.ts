import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { SchemaTable } from '../../../shared/tools'
import { arrange, type Layout, type Point } from './arrange'
import { toDbml } from './dbml'
import type { View } from './erd-canvas'
import { schemaToModel } from './schema-to-model'

/**
 * Owns the diagram's state: the model built from the live schema, the stored
 * layout, the view transform and the saving.
 *
 * The schema itself is not read here — it comes from the same `useSchema` the
 * Tools view uses, so picking a tenant in one place does not leave the other
 * showing a different database.
 */
export function useErd(container: TinkerContainer | null, tables: SchemaTable[], tenant: string) {
  const [layout, setLayout] = useState<Layout>({})
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const database = tenant === '' ? 'central' : tenant

  const model = useMemo(
    () => schemaToModel(tables, database, 'central'),
    [tables, database],
  )

  // The stored layout belongs to the repository, so it is read once per
  // container rather than once per schema load.
  useEffect(() => {
    if (container === null) {
      return
    }

    let cancelled = false

    void window.ray.readErd(container.id, container.workingDir).then((stored) => {
      if (!cancelled) {
        setLayout((current) => ({ ...stored.layout, ...current }))
        setSavedAt(stored.savedAt)
        setError(stored.error)
      }
    })

    return () => {
      cancelled = true
    }
  }, [container])

  // Re-arranging keeps every position it already has, so a new table appears
  // without the rest of the diagram jumping.
  useEffect(() => {
    setLayout((current) => arrange(model, current))
  }, [model])

  const save = useCallback(async (): Promise<void> => {
    if (container === null) {
      return
    }

    setSaving(true)

    try {
      const result = await window.ray.saveErd(
        container.id,
        container.workingDir,
        toDbml(model),
        layout,
      )

      setSaved(result.files)
      setError(result.error)
      setSavedAt(result.error === null ? new Date().toISOString() : savedAt)
    } finally {
      setSaving(false)
    }
  }, [container, model, layout, savedAt])

  return {
    model,
    layout,
    view,
    setView,
    selected,
    setSelected,
    saved,
    savedAt,
    error,
    saving,
    save,
    database,
    move: useCallback((table: string, at: Point) => {
      setLayout((current) => ({ ...current, [table]: at }))
    }, []),
    /** Auto-arrange discards what is there, which is what the button says. */
    rearrange: useCallback(() => setLayout(arrange(model, {})), [model]),
  }
}

export type ErdState = ReturnType<typeof useErd>
