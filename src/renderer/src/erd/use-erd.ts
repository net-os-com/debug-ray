import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { SchemaTable } from '../../../shared/tools'
import { arrange, type Layout, type Point } from './arrange'
import { toDbml } from './dbml'
import type { View } from './erd-canvas'
import type { ErdModel } from './model'
import { parseDbml } from './parse'
import { problemsOf } from './problems'
import { schemaToModel } from './schema-to-model'
import { readStickies, type Sticky } from './stickies'

const EMPTY: ErdModel = { tables: [], relations: [], enums: [], groups: [] }

/**
 * Owns the diagram. The DBML source is the state; the model is parsed from it.
 *
 * The schema itself is not read here — it comes from the same `useSchema` the
 * Tools view uses, and importing turns that into source rather than into a
 * diagram of its own.
 */
export function useErd(container: TinkerContainer | null, tables: SchemaTable[], tenant: string) {
  const [code, setCode] = useState('')
  const [committed, setCommitted] = useState('')
  const [layout, setLayout] = useState<Layout>({})
  const [stickies, setStickies] = useState<Sticky[]>([])
  const [committedStickies, setCommittedStickies] = useState('[]')
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [read, setRead] = useState(false)
  /** Set when an import is asked for; cleared when the tables that answer it land. */
  const [importing, setImporting] = useState(false)
  /** The table list as it stood when the import was asked for. */
  const asked = useRef<SchemaTable[] | null>(null)

  const parsed = useMemo(() => parseDbml(code), [code])
  const problems = useMemo(() => problemsOf(parsed), [parsed])

  // A source half-way through an edit does not parse, and blanking the canvas
  // on every other keystroke would make it unreadable. The last good model
  // stays on screen until a new one arrives.
  const lastGood = useRef<ErdModel>(EMPTY)

  if (parsed.ok) {
    lastGood.current = parsed.model
  }

  const model = parsed.ok ? parsed.model : lastGood.current
  const names = model.tables.map((table) => table.name).join('\u0000')
  const previousNames = useRef(names)

  useEffect(() => {
    if (container === null) {
      return
    }

    let cancelled = false

    void window.ray.readErd(container.id, container.workingDir).then((stored) => {
      if (!cancelled) {
        const notes = readStickies(stored.stickies)

        setCode(stored.dbml)
        setCommitted(stored.dbml)
        setLayout(stored.layout)
        setStickies(notes)
        setCommittedStickies(JSON.stringify(notes))
        setError(stored.error)
        setRead(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [container])

  /**
   * Arranging waits for the stored layout and refuses an empty model: it keeps
   * only the tables it is given, so running early would discard positions
   * somebody placed by hand and the next save would commit the loss.
   *
   * It also carries a rename across, because the layout keys on table name and
   * a renamed table would otherwise drop back into the auto-arrange corner.
   */
  useEffect(() => {
    if (!read || model.tables.length === 0) {
      return
    }

    const before = previousNames.current.split('\u0000').filter((one) => one !== '')
    const after = names.split('\u0000').filter((one) => one !== '')

    previousNames.current = names

    setLayout((current) => arrange(model, carryRenames(before, after, current)))
    // `names` rather than `model`: typing a comment reparses into a new object
    // but the same tables, and re-arranging on that would be a jump for nothing.
  }, [read, names])

  /**
   * The import completes here, when the tables it asked for have landed.
   *
   * It waits for a *different* array than the one that was on screen when the
   * request was made, not merely for a non-empty one: `loadTables` is started
   * in the same handler, so the render right after the click still holds the
   * previous list, and keying on emptiness re-imported that stale snapshot and
   * then cleared the flag before the fresh tables arrived.
   */
  useEffect(() => {
    if (!importing || tables === asked.current) {
      return
    }

    asked.current = null
    setImporting(false)

    if (tables.length > 0) {
      setCode(toDbml(schemaToModel(tables, tenant === '' ? 'central' : tenant, 'central')))
    }
  }, [importing, tables, tenant])

  const save = useCallback(async (): Promise<void> => {
    if (container === null) {
      return
    }

    setSaving(true)

    try {
      const result = await window.ray.saveErd(container.id, container.workingDir, code, layout, stickies)

      setSaved(result.files)
      setError(result.error)

      if (result.error === null) {
        setCommitted(code)
        setCommittedStickies(JSON.stringify(stickies))
      }
    } finally {
      setSaving(false)
    }
  }, [container, code, layout, stickies])

  return {
    code,
    setCode,
    model,
    problems,
    layout,
    view,
    setView,
    selected,
    setSelected,
    saved,
    error,
    saving,
    save,
    /** True when the editor or the canvas holds something the repository does not. */
    dirty: code !== committed || JSON.stringify(stickies) !== committedStickies,
    stickies,
    addSticky: useCallback(() => {
      setStickies((current) => [
        ...current,
        {
          id: `s${Date.now().toString(36)}`,
          text: '',
          // Placed where you are looking: on a fitted diagram the origin is
          // usually off screen.
          x: Math.round(-view.x / view.z) + 60,
          y: Math.round(-view.y / view.z) + 60,
        },
      ])
    }, [view]),
    moveSticky: useCallback((id: string, at: Point) => {
      setStickies((current) => current.map((one) => (one.id === id ? { ...one, ...at } : one)))
    }, []),
    setStickyText: useCallback((id: string, text: string) => {
      setStickies((current) => current.map((one) => (one.id === id ? { ...one, text } : one)))
    }, []),
    removeSticky: useCallback((id: string) => {
      setStickies((current) => current.filter((one) => one.id !== id))
    }, []),
    importing,
    /**
     * Asks for an import rather than performing one.
     *
     * The tables arrive from a separate hook one render later, so turning them
     * into source here would read the set from before the load — the same stale
     * closure that made the tenant switch read the previous database.
     */
    importFromMySql: useCallback(() => {
      asked.current = tables
      setImporting(true)
    }, [tables]),
    move: useCallback((table: string, at: Point) => {
      setLayout((current) => ({ ...current, [table]: at }))
    }, []),
    rearrange: useCallback(() => setLayout(arrange(model, {})), [model]),
  }
}

export type ErdState = ReturnType<typeof useErd>

/**
 * One name out, one name in: treat it as the same table and carry its position.
 *
 * Anything less specific would move a position onto an unrelated table the
 * moment two things change at once, which is worse than losing one.
 */
function carryRenames(previous: string[], current: string[], layout: Layout): Layout {
  const gone = previous.filter((name) => !current.includes(name))
  const added = current.filter((name) => !previous.includes(name))

  if (gone.length !== 1 || added.length !== 1) {
    return layout
  }

  const from = gone[0] as string
  const to = added[0] as string
  const position = layout[from]

  if (position === undefined) {
    return layout
  }

  const next = { ...layout, [to]: position }

  delete next[from]

  return next
}
