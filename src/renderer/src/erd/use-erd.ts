import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { SchemaTable } from '../../../shared/tools'
import { arrange, type Layout, type Point } from './arrange'
import { toDbml } from './dbml'
import type { View } from './erd-canvas'
import type { ErdModel, ErdTable } from './model'
import { parseDbml } from './parse'
import { problemsOf } from './problems'
import { schemaToModel } from './schema-to-model'
import { addNote, addTable, setNoteText } from './patch'
import { stickies as stickiesOf, stickyKey } from './stickies'

/** Long enough that a pause in typing is a pause, not a gap between words. */
const AUTO_SAVE_AFTER_MS = 1_200

/** Typing within this window joins the step before it. */
const UNDO_COALESCE_MS = 600

/** Deep enough to walk back a session, shallow enough to stay cheap. */
const MAX_UNDO = 200

const EMPTY: ErdModel = { tables: [], relations: [], enums: [], groups: [], notes: [] }

/**
 * Owns the diagram. The DBML source is the state; the model is parsed from it.
 *
 * The schema itself is not read here — it comes from the same `useSchema` the
 * Tools view uses, and importing turns that into source rather than into a
 * diagram of its own.
 */
export function useErd(
  container: TinkerContainer | null,
  tables: SchemaTable[],
  tenant: string,
  /** False until Docker has answered, so "no container" is told from "not asked". */
  containersRead: boolean,
  /** Writes a moment after you stop typing, when the file parses. */
  autoSave: boolean,
) {
  const [code, writeCode] = useState('')
  /**
   * The source's own undo stack.
   *
   * The textarea has a native one, but it only knows about typing — the
   * patches that add a table, rename a column or drop a note replace the
   * source from outside it, and a native undo would step back over an edit it
   * never saw. One stack that records every change is the only way the two
   * kinds of edit can be undone in the order they happened.
   */
  const history = useRef<{ past: string[]; future: string[]; at: number; last: string }>({
    past: [],
    future: [],
    at: 0,
    last: '',
  })
  const [depth, setDepth] = useState({ past: 0, future: 0 })
  const [committed, setCommitted] = useState('')

  /** Replaces the source and remembers what it replaced. */
  const setCode = useCallback((next: string): void => {
    const current = history.current

    if (next === current.last) {
      return
    }

    // Consecutive keystrokes collapse into one step, so undo moves by a word
    // or a line rather than by a character.
    if (current.at === 0 || Date.now() - current.at > UNDO_COALESCE_MS) {
      current.past.push(current.last)

      if (current.past.length > MAX_UNDO) {
        current.past.shift()
      }
    }

    current.at = Date.now()
    current.future = []
    current.last = next

    writeCode(next)
    setDepth({ past: current.past.length, future: 0 })
  }, [])

  /** Replaces the source without recording it: a read is not an edit. */
  const resetCode = useCallback((next: string): void => {
    history.current = { past: [], future: [], at: 0, last: next }
    writeCode(next)
    setDepth({ past: 0, future: 0 })
  }, [])

  const undo = useCallback((): void => {
    const current = history.current
    const previous = current.past.pop()

    if (previous === undefined) {
      return
    }

    current.future.push(current.last)
    current.last = previous
    // Zeroed so the next keystroke starts a fresh step rather than merging
    // into the one just undone.
    current.at = 0
    writeCode(previous)
    setDepth({ past: current.past.length, future: current.future.length })
  }, [])

  const redo = useCallback((): void => {
    const current = history.current
    const next = current.future.pop()

    if (next === undefined) {
      return
    }

    current.past.push(current.last)
    current.last = next
    current.at = 0
    writeCode(next)
    setDepth({ past: current.past.length, future: current.future.length })
  }, [])
  const [committedLayout, setCommittedLayout] = useState('{}')
  const [toast, setToast] = useState<string | null>(null)
  /** Which column's form is open in the inspector. */
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const [layout, setLayout] = useState<Layout>({})
  const [view, setView] = useState<View>({ x: 0, y: 0, z: 1 })
  const [selected, setSelected] = useState<string | null>(null)
  const [saved, setSaved] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [read, setRead] = useState(false)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState('')
  /** Set when an import is asked for; cleared when the tables that answer it land. */
  const [importing, setImporting] = useState(false)
  /** The table list as it stood when the import was asked for. */
  const asked = useRef<SchemaTable[] | null>(null)
  /**
   * Its own flag, not `importing`.
   *
   * `importing` means "waiting for useSchema to hand me new tables", and the
   * effect that watches it would fire on the tables already in hand and
   * overwrite the migrations with the live schema.
   */
  const [migrating, setMigrating] = useState(false)

  /** Shown for a moment after something the canvas cannot otherwise report. */
  const announce = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600)
  }, [])

  const parsed = useMemo(() => parseDbml(code), [code])

  // A source half-way through an edit does not parse, and blanking the canvas
  // on every other keystroke would make it unreadable. The last good model
  // stays on screen until a new one arrives.
  const lastGood = useRef<ErdModel>(EMPTY)

  if (parsed.ok) {
    lastGood.current = parsed.model
  }

  const model = parsed.ok ? parsed.model : lastGood.current
  const problems = useMemo(() => problemsOf(parsed, model, code), [parsed, model, code])
  const names = model.tables.map((table) => table.name).join('\u0000')
  const previousNames = useRef(names)

  useEffect(() => {
    if (container === null) {
      return
    }

    // Lowered again for a second container, or the next read would show the
    // previous schema's result while it is still fetching.
    setRead(false)

    let cancelled = false

    void window.ray.readErd(container.id, container.workingDir).then((stored) => {
      if (!cancelled) {
        resetCode(stored.dbml)
        setCommitted(stored.dbml)
        setLayout(stored.layout)
        setCommittedLayout(JSON.stringify(stored.layout))
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
      announce(`Imported ${tables.length} tables from MySQL`)
    }
  }, [importing, tables, tenant, announce])

  const stickies = useMemo(() => stickiesOf(model, layout), [model, layout])

  /**
   * The search and the scope dim rather than remove.
   *
   * Hiding a table takes its relations off the canvas with it, which is the one
   * thing you are usually looking for when you search — "what points at this".
   * The design dims instead, so the shape stays and the answer is still drawn.
   */
  const matches = useCallback(
    (table: ErdTable): boolean => {
      const needle = query.trim().toLowerCase()

      return (
        (scope === '' || table.scope === scope) &&
        (needle === '' ||
          table.name.toLowerCase().includes(needle) ||
          table.columns.some((column) => column.name.toLowerCase().includes(needle)))
      )
    },
    [query, scope],
  )

  const save = useCallback(async (): Promise<void> => {
    if (container === null) {
      return
    }

    setSaving(true)

    try {
      const result = await window.ray.saveErd(container.id, container.workingDir, code, layout, [])

      setSaved(result.files)
      setError(result.error)

      if (result.error === null) {
        setCommitted(code)
        setCommittedLayout(JSON.stringify(layout))
        announce(`Saved ${result.files.join(' and ')}`)
      }
    } finally {
      setSaving(false)
    }
  }, [container, code, layout, announce])

  /**
   * Writes on your behalf, a pause after the last keystroke.
   *
   * Two guards, both deliberate. It waits for the source to parse, because a
   * half-typed table is a file that the next read cannot open — autosaving it
   * would turn a transient mistake into a committed one. And it only runs when
   * there is something to write, so idling in this view does not rewrite the
   * file on a timer.
   */
  const dirty = code !== committed || JSON.stringify(layout) !== committedLayout

  const latestSave = useRef(save)
  latestSave.current = save

  useEffect(() => {
    if (!autoSave || !dirty || saving || !parsed.ok) {
      return
    }

    const timer = setTimeout(() => void latestSave.current(), AUTO_SAVE_AFTER_MS)

    return () => clearTimeout(timer)
  }, [autoSave, dirty, saving, parsed.ok, code, layout])

  return {
    code,
    setCode,
    undo,
    redo,
    canUndo: depth.past > 0,
    canRedo: depth.future > 0,
    model,
    /** Which tables the search and the scope match; the rest are dimmed. */
    matches,
    query,
    setQuery,
    scope,
    setScope,
    problems,
    layout,
    view,
    setView,
    selected,
    setSelected,
    editingColumn,
    setEditingColumn,
    saved,
    error,
    setError,
    saving,
    save,
    /**
     * True while there is still something to wait for.
     *
     * The view cannot tell "no schema yet" from "not read yet" by looking at
     * the source — both are empty — so without this the start screen flashed
     * on the way in, offering to import over a file that was about to arrive.
     *
     * The container counts as waiting too. Gating on the read alone only moved
     * the flash earlier: the container list arrives from Docker a moment after
     * the window does, and until it has there is no container to read from, so
     * the start screen showed in that gap instead. Once Docker has answered
     * and there is genuinely no container, there is nothing to wait for.
     */
    loading: !containersRead || (container !== null && !read),
    toast,
    announce,
    /** True when the editor or the canvas holds something the repository does not. */
    dirty,
    stickies,
    /** A note is DBML, so adding one is a patch of the source. */
    addNote: useCallback(() => {
      const name = `note_${model.notes.length + 1}`
      const result = addNote(code, name, 'Write the note here.')

      if (!result.ok) {
        setError(result.reason)

        return
      }

      setError(null)
      setCode(result.code)
      // Placed where you are looking: on a fitted diagram the origin is usually
      // off screen.
      setLayout((current) => ({
        ...current,
        [stickyKey(name)]: {
          x: Math.round(-view.x / view.z) + 60,
          y: Math.round(-view.y / view.z) + 60,
        },
      }))
    }, [code, model.notes.length, view]),
    addTable: useCallback(() => {
      const scopes = [...new Set(model.tables.map((table) => table.scope))]
      const prefix = scopes.length === 1 && scopes[0] !== undefined ? `${scopes[0]}.` : ''
      const taken = new Set(model.tables.map((table) => table.name))
      let index = 1

      while (taken.has(`${prefix}table_${index}`)) {
        index += 1
      }

      const result = addTable(code, `${prefix}table_${index}`)

      if (!result.ok) {
        setError(result.reason)

        return
      }

      setError(null)
      setCode(result.code)
    }, [code, model.tables]),
    /**
     * Writes a note's text from the canvas.
     *
     * A refusal is swallowed rather than shown: this runs on every keystroke,
     * and a half-typed note that momentarily will not parse is the normal way
     * through to one that does. The next keystroke patches again, and the
     * editor's own problem badge is what reports a source that stays broken.
     */
    editNote: useCallback(
      (name: string, text: string) => {
        const result = setNoteText(code, name, text)

        if (result.ok) {
          setCode(result.code)
        }
      },
      [code, setCode],
    ),
    moveSticky: useCallback((name: string, at: Point) => {
      setLayout((current) => ({ ...current, [stickyKey(name)]: at }))
    }, []),
    /** Moves every card a group holds, so the rectangle travels with them. */
    moveGroup: useCallback(
      (group: string, delta: Point) => {
        const members = model.groups.find((one) => one.name === group)?.tables ?? []

        setLayout((current) => {
          const next = { ...current }

          for (const name of members) {
            const at = next[name]

            if (at !== undefined) {
              next[name] = { x: at.x + delta.x, y: at.y + delta.y }
            }
          }

          return next
        })
      },
      [model.groups],
    ),
    importing: importing || migrating,
    /** Reads the repository's migrations instead of the live database. */
    importFromMigrations: useCallback(async (): Promise<void> => {
      // Said rather than ignored: the button is offered before a container is
      // picked, and a press that does nothing at all reads as a broken button.
      if (container === null) {
        setError('Pick a container in Tinker first — the migrations run inside it.')

        return
      }

      setMigrating(true)

      try {
        const result = await window.ray.erdFromMigrations(container.id, container.workingDir)

        setError(result.error)

        if (result.tables.length > 0) {
          setCode(toDbml(schemaToModel(result.tables, 'central', 'central')))
          announce(`Imported ${result.tables.length} tables from migrations`)
        }
      } finally {
        setMigrating(false)
      }
    }, [container, announce]),
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
