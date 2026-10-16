import { useEffect, useRef, useState } from 'react'
import { EditorPane } from './editor-pane'
import { ErdCanvas, fitView, MAX_ZOOM, MIN_ZOOM } from './erd-canvas'
import { ErdSidebar } from './erd-sidebar'
import { toMigrations, toSql } from './exports'
import { toSvg } from './svg-export'
import { toPng } from './png-export'
import { ChevronIcon, MinusIcon, PanelIcon, PlusIcon, RedoIcon, UndoIcon } from './icons'
import { Inspector } from './inspector'
import { CENTRAL, SCOPE_COLORS, TENANT } from './model'
import type { ErdState } from './use-erd'

type Modal = { title: string; subtitle: string; text: string }

type ErdViewProps = {
  erd: ErdState
  tenants: string[]
  tenant: string
  loading: boolean
  onTenant: (tenant: string) => void
  onImport: () => void
  /** Opens a snippet in Tinker, which is where the inspector's links go. */
  onTinker: (snippet: string) => void
  onRequests: (table: string) => void
}

export function ErdView({
  erd,
  tenants,
  tenant,
  loading,
  onTenant,
  onImport,
  onTinker,
  onRequests,
}: ErdViewProps) {
  const canvas = useRef<HTMLDivElement>(null)
  const [sideOpen, setSideOpen] = useState(true)
  const [editorOpen, setEditorOpen] = useState(true)
  const [menu, setMenu] = useState<'import' | 'export' | 'add' | null>(null)
  const [modal, setModal] = useState<Modal | null>(null)
  const [copied, setCopied] = useState(false)

  /**
   * An import replaces everything in the editor, so unsaved work is confirmed
   * away rather than discarded in silence.
   */
  const replacing = (what: string, run: () => void): void => {
    setMenu(null)

    if (!erd.dirty || window.confirm(`Replace the editor with ${what}? Unsaved changes are lost.`)) {
      run()
    }
  }

  /*
   * Undo belongs to the whole view, not only to the textarea: a patch from the
   * inspector is as undoable as a keystroke. preventDefault stops the
   * textarea's own undo running as well, which would step the DOM back without
   * telling the stack and leave the two disagreeing.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') {
        return
      }

      event.preventDefault()

      if (event.shiftKey) {
        erd.redo()
      } else {
        erd.undo()
      }
    }

    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [erd])

  const fit = (): void => {
    const box = canvas.current?.getBoundingClientRect()

    erd.setView(fitView(erd.model, erd.layout, box?.width ?? 0, box?.height ?? 0))
  }

  const zoomBy = (factor: number): void => {
    const box = canvas.current?.getBoundingClientRect()
    const width = box?.width ?? 0
    const height = box?.height ?? 0
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, erd.view.z * factor))
    const ratio = next / erd.view.z

    // Around the middle of the canvas, which is what the buttons imply: the
    // wheel is the one that follows the pointer.
    erd.setView({
      x: width / 2 - (width / 2 - erd.view.x) * ratio,
      y: height / 2 - (height / 2 - erd.view.y) * ratio,
      z: next,
    })
  }

  // Fitting once after an import saves the first thing you do from being the
  // thing that makes the diagram visible. It waits for every table to have a
  // position, not merely for tables to exist: the layout is filled by its own
  // effect, so fitting on the render where the tables arrive measures a box
  // that is still half empty.
  const fitted = useRef('')
  const placed = erd.model.tables.filter((table) => erd.layout[table.name] !== undefined).length
  const shape = erd.model.tables.map((table) => table.name).join(',')

  useEffect(() => {
    if (fitted.current !== shape && placed > 0 && placed === erd.model.tables.length) {
      fitted.current = shape
      fit()
    }
  })

  // Looked up fresh each render: after a patch the model is reparsed, and a
  // panel holding the table object from before would show the old values.
  const selected = erd.model.tables.find((table) => table.name === erd.selected) ?? null

  /**
   * Writes a picture of the diagram, rather than showing it in the modal.
   *
   * The other exports are text you copy somewhere; an image is a file, and the
   * only useful thing to do with it is put it on disk.
   */
  const saveImage = async (kind: 'svg' | 'png'): Promise<void> => {
    setMenu(null)

    const svg = toSvg(erd.model, erd.layout)

    if (svg === '') {
      erd.announce('There is nothing placed to export yet.')

      return
    }

    try {
      const answer = await window.ray.saveErdFile({
        name: `schema.${kind}`,
        what: kind === 'svg' ? 'SVG image' : 'PNG image',
        extension: kind,
        data: kind === 'svg' ? svg : await toPng(svg),
        base64: kind === 'png',
      })

      if (answer.error !== null) {
        erd.announce(answer.error)

        return
      }

      if (answer.path !== null) {
        erd.announce(`Saved ${answer.path.split('/').pop() ?? answer.path}`)
      }
    } catch (error) {
      erd.announce(error instanceof Error ? error.message : 'The image could not be written.')
    }
  }

  const openExport = (title: string, subtitle: string, text: string): void => {
    setMenu(null)
    setCopied(false)
    setModal({ title, subtitle, text })
  }

  // Gated on the source, not on the model: a committed file that does not parse
  // has no tables either, and showing the start screen for it hid the problem
  // pane that explains why — while offering an import that would overwrite the
  // very file you could not see.
  //
  // And only once the file has actually been read. An unread source is empty
  // too, so the start screen used to flash on the way in and offer an import
  // over a schema that was a moment from arriving.
  const empty = !erd.loading && erd.code.trim() === ''

  return (
    <div className="erd" onClick={() => setMenu(null)}>
      <div className="erd__split">
        {sideOpen ? (
          <ErdSidebar
            model={erd.model}
            onQuery={erd.setQuery}
            onScope={erd.setScope}
            onSelect={erd.setSelected}
            query={erd.query}
            scope={erd.scope}
            selected={erd.selected}
          />
        ) : null}

        {editorOpen ? (
          <EditorPane
            code={erd.code}
            onChange={erd.setCode}
            problems={erd.problems}
            savedLabel={erd.dirty ? 'Unsaved changes' : erd.saved.length > 0 ? 'Saved' : ''}
          />
        ) : null}

        <section className="erd__main">
          <div className="erd__bar">
            <div className="erd__pills">
              {(
                [
                  ['Tables', sideOpen, () => setSideOpen((open) => !open)],
                  ['Code', editorOpen, () => setEditorOpen((open) => !open)],
                ] as const
              ).map(([label, on, toggle]) => (
                <button
                  className={on ? 'erd__pill erd__pill--on' : 'erd__pill'}
                  key={label}
                  onClick={toggle}
                  title={`Show or hide the ${label === 'Tables' ? 'table list' : 'DBML editor'}`}
                  type="button"
                >
                  <PanelIcon />
                  {label}
                </button>
              ))}
            </div>

            <span className="erd__divider" />

            <div className="erd__menu">
              <button
                className="button"
                disabled={loading || erd.importing}
                onClick={(event) => {
                  event.stopPropagation()
                  setMenu((current) => (current === 'import' ? null : 'import'))
                }}
                type="button"
              >
                {erd.importing ? 'Importing…' : 'Import'}
                <ChevronIcon />
              </button>
              {menu === 'import' ? (
                <div className="erd__dropdown" onClick={(event) => event.stopPropagation()}>
                  <button
                    className="erd__item"
                    onClick={() => replacing('the live schema', onImport)}
                    type="button"
                  >
                    <span className="erd__item-label">From MySQL</span>
                    <span className="erd__item-meta">
                      {tenant === '' ? 'central database' : tenant}
                    </span>
                  </button>
                  <button
                    className="erd__item"
                    onClick={() =>
                      replacing('the schema your migrations build', () =>
                        void erd.importFromMigrations(),
                      )
                    }
                    type="button"
                  >
                    <span className="erd__item-label">From Laravel migrations</span>
                    <span className="erd__item-meta">run in a throwaway database</span>
                  </button>
                </div>
              ) : null}
            </div>

            <div className="erd__menu">
              <button
                className="button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenu((current) => (current === 'export' ? null : 'export'))
                }}
                type="button"
              >
                Export
                <ChevronIcon />
              </button>
              {menu === 'export' ? (
                <div className="erd__dropdown" onClick={(event) => event.stopPropagation()}>
                  <button
                    className="erd__item"
                    onClick={() =>
                      openExport(
                        'Laravel migrations',
                        `${erd.model.tables.length} tables · central tables use the central connection`,
                        toMigrations(erd.model),
                      )
                    }
                    type="button"
                  >
                    <span className="erd__item-label">Laravel migrations</span>
                    <span className="erd__item-meta">split into central/ and tenant/</span>
                  </button>
                  <button
                    className="erd__item"
                    onClick={() =>
                      openExport(
                        'SQL (MySQL)',
                        'Cross-database references are left out',
                        toSql(erd.model),
                      )
                    }
                    type="button"
                  >
                    <span className="erd__item-label">SQL (MySQL)</span>
                    <span className="erd__item-meta">one script per database</span>
                  </button>
                  <button
                    className="erd__item"
                    onClick={() => openExport('DBML', 'The file as it will be saved', erd.code)}
                    type="button"
                  >
                    <span className="erd__item-label">DBML</span>
                    <span className="erd__item-meta">paste into dbdiagram.io</span>
                  </button>
                  <span className="erd__item-rule" />
                  <button
                    className="erd__item"
                    onClick={() => void saveImage('svg')}
                    type="button"
                  >
                    <span className="erd__item-label">SVG image</span>
                    <span className="erd__item-meta">vector, scales to any size</span>
                  </button>
                  <button
                    className="erd__item"
                    onClick={() => void saveImage('png')}
                    type="button"
                  >
                    <span className="erd__item-label">PNG image</span>
                    <span className="erd__item-meta">at twice the pixels</span>
                  </button>
                </div>
              ) : null}
            </div>

            <span className="erd__divider" />

            <button className="button" onClick={erd.rearrange} type="button">
              Auto-arrange
            </button>

            <select
              className="input input--select erd__tenant"
              onChange={(event) => onTenant(event.target.value)}
              value={tenant}
            >
              <option value="">Central database</option>
              {tenants.map((one) => (
                <option key={one} value={one}>
                  {one}
                </option>
              ))}
            </select>

            <div className="erd__history">
              <button
                className="erd__zoom-button"
                disabled={!erd.canUndo}
                onClick={erd.undo}
                title="Undo (⌘Z)"
                type="button"
              >
                <UndoIcon />
              </button>
              <button
                className="erd__zoom-button"
                disabled={!erd.canRedo}
                onClick={erd.redo}
                title="Redo (⇧⌘Z)"
                type="button"
              >
                <RedoIcon />
              </button>
            </div>

            <div className="erd__zoomer">
              <button className="erd__zoom-button" onClick={() => zoomBy(1 / 1.2)} title="Zoom out" type="button">
                <MinusIcon />
              </button>
              <span className="erd__zoom">{Math.round(erd.view.z * 100)}%</span>
              <button className="erd__zoom-button" onClick={() => zoomBy(1.2)} title="Zoom in" type="button">
                <PlusIcon />
              </button>
              <button className="erd__fit" onClick={fit} type="button">
                Fit
              </button>
            </div>

            <button
              className="button button--primary"
              disabled={erd.saving || !erd.dirty}
              onClick={erd.save}
              type="button"
            >
              {erd.saving ? 'Saving…' : erd.dirty ? 'Save' : 'Saved'}
            </button>
          </div>

          <div className="erd-canvas-host" ref={canvas}>
            <ErdCanvas
              layout={erd.layout}
              matches={erd.matches}
              model={erd.model}
              onColumn={(table, column) => {
                erd.setSelected(table)
                erd.setEditingColumn(column)
              }}
              onGroupMove={erd.moveGroup}
              onMove={erd.move}
              onSelect={(table) => {
                erd.setSelected(table)
                erd.setEditingColumn(null)
              }}
              onStickyEdit={erd.editNote}
              onStickyMove={erd.moveSticky}
              onView={erd.setView}
              selected={erd.selected}
              stickies={erd.stickies}
              view={erd.view}
            />

            {/*
              * Adding lives on the diagram rather than in the toolbar: what you
              * add lands here, and the button that adds it should be where you
              * are looking when you decide to.
              */}
            <div
              className="erd__add"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button
                className="button erd__add-button"
                onClick={(event) => {
                  event.stopPropagation()
                  setMenu((current) => (current === 'add' ? null : 'add'))
                }}
                type="button"
              >
                <PlusIcon />
                Add
                <ChevronIcon />
              </button>

              {menu === 'add' ? (
                <div className="erd__dropdown" onClick={(event) => event.stopPropagation()}>
                  <button
                    className="erd__item"
                    onClick={() => {
                      setMenu(null)
                      erd.addTable()
                    }}
                    type="button"
                  >
                    <span className="erd__item-label">Table</span>
                    <span className="erd__item-meta">in the current scope</span>
                  </button>
                  <button
                    className="erd__item"
                    onClick={() => {
                      setMenu(null)
                      erd.addNote()
                    }}
                    type="button"
                  >
                    <span className="erd__item-label">Note</span>
                    <span className="erd__item-meta">a sticky on the canvas</span>
                  </button>
                </div>
              ) : null}
            </div>

            {erd.model.tables.length > 0 ? (
              <div className="erd__legend" onPointerDown={(event) => event.stopPropagation()}>
                <span>
                  <span className="erd__chip" style={{ background: SCOPE_COLORS[CENTRAL] }} />
                  Central · the shared database
                </span>
                <span>
                  <span className="erd__chip" style={{ background: SCOPE_COLORS[TENANT] }} />
                  Tenant · one database per tenant
                </span>
                <span>
                  <svg height="6" width="22">
                    <path
                      d="M0 3h22"
                      stroke="var(--err-fg)"
                      strokeDasharray="4 3"
                      strokeWidth="1.6"
                    />
                  </svg>
                  Cross-database reference
                </span>
              </div>
            ) : null}

            {selected === null ? null : (
              <Inspector
                code={erd.code}
                editing={erd.editingColumn}
                model={erd.model}
                onClose={() => erd.setSelected(null)}
                onCode={erd.setCode}
                onEditing={erd.setEditingColumn}
                onRequests={onRequests}
                onTinker={onTinker}
                table={selected}
              />
            )}

            {erd.loading ? (
              <div className="erd__empty">
                <div className="erd__empty-inner">
                  <div className="erd__loading">
                    <span className="erd__spinner" />
                    Reading schema.dbml
                  </div>
                </div>
              </div>
            ) : null}

            {empty ? (
              <div className="erd__empty">
                <div className="erd__empty-inner">
                  <div className="erd__empty-title">Start your schema</div>
                  <div className="erd__empty-hint">
                    Write DBML on the left and the diagram draws itself. Use the central schema for
                    the shared database and tenant for tables every tenant database gets.
                  </div>
                  <div className="erd__empty-actions">
                    <button
                      className="button button--primary"
                      disabled={loading}
                      onClick={() => replacing('the live schema', onImport)}
                      type="button"
                    >
                      {loading ? 'Reading…' : 'Import from MySQL'}
                    </button>
                    <button
                      className="button"
                      disabled={erd.importing}
                      onClick={() =>
                        replacing('the schema your migrations build', () =>
                          void erd.importFromMigrations(),
                        )
                      }
                      type="button"
                    >
                      {erd.importing ? 'Migrating…' : 'Import from migrations'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {erd.error === null ? null : (
              <div className="erd__banner" onPointerDown={(event) => event.stopPropagation()}>
                {erd.error}
                <button className="erd__banner-close" onClick={() => erd.setError(null)} type="button">
                  ×
                </button>
              </div>
            )}

            {erd.toast === null ? null : <div className="erd__toast">{erd.toast}</div>}
          </div>
        </section>
      </div>

      {modal === null ? null : (
        <div className="erd__overlay" onClick={() => setModal(null)}>
          <div className="erd__modal" onClick={(event) => event.stopPropagation()}>
            <div className="erd__modal-head">
              <div>
                <div className="erd__modal-title">{modal.title}</div>
                <div className="erd__modal-sub">{modal.subtitle}</div>
              </div>
              <button
                className="button button--primary"
                onClick={() => {
                  void navigator.clipboard.writeText(modal.text).catch(() => {})
                  setCopied(true)
                }}
                type="button"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button className="button" onClick={() => setModal(null)} type="button">
                Close
              </button>
            </div>
            <pre className="erd__modal-body">{modal.text}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
