import { useEffect, useRef } from 'react'
import { ErdCanvas, fitView } from './erd-canvas'
import type { ErdState } from './use-erd'

type ErdViewProps = {
  erd: ErdState
  tenants: string[]
  tenant: string
  loading: boolean
  onTenant: (tenant: string) => void
  onImport: () => void
}

export function ErdView({ erd, tenants, tenant, loading, onTenant, onImport }: ErdViewProps) {
  const canvas = useRef<HTMLDivElement>(null)

  const fit = (): void => {
    const box = canvas.current?.getBoundingClientRect()

    erd.setView(fitView(erd.model, erd.layout, box?.width ?? 0, box?.height ?? 0))
  }

  // Fitting once after an import saves the first thing you do from being the
  // thing that makes the diagram visible.
  //
  // It waits for every table to have a position, not merely for tables to
  // exist: the layout is filled by its own effect, so fitting on the render
  // where the tables arrive measures a box that is still half empty.
  const fitted = useRef('')
  const placed = erd.model.tables.filter((table) => erd.layout[table.name] !== undefined).length

  // Keyed on which tables are on screen rather than on the database: the source
  // is now the state, so the diagram changes shape when you edit it, not only
  // when you switch tenant. Typing inside a table does not re-fit.
  const shape = erd.model.tables.map((table) => table.name).join(',')

  useEffect(() => {
    if (fitted.current !== shape && placed > 0 && placed === erd.model.tables.length) {
      fitted.current = shape
      fit()
    }
  })

  if (erd.model.tables.length === 0) {
    return (
      <div className="erd">
        <div className="erd__empty">
          <div className="erd__empty-inner">
            <div className="erd__empty-title">Start your schema</div>
            <div className="erd__empty-hint">
              Read the tables straight out of the database this project is connected to, and write
              the result next to your migrations as a dbml file you can commit.
            </div>
            <button
              className="button button--primary"
              disabled={loading}
              onClick={onImport}
              type="button"
            >
              {loading ? 'Reading…' : 'Import from MySQL'}
            </button>
            {erd.error === null ? null : <div className="erd__error">{erd.error}</div>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="erd">
      <div className="erd__bar">
        <select
          className="input input--select"
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
        <button className="button" disabled={loading} onClick={onImport} type="button">
          {loading ? 'Reading…' : 'Reload'}
        </button>
        <button className="button" onClick={erd.rearrange} type="button">
          Auto-arrange
        </button>
        <button className="button" onClick={fit} type="button">
          Fit
        </button>
        <span className="erd__zoom">{Math.round(erd.view.z * 100)}%</span>
        <span className="erd__spacer" />
        {erd.error === null ? null : <span className="erd__error">{erd.error}</span>}
        {erd.saved.length > 0 && erd.error === null ? (
          <span className="erd__saved">{erd.saved.join('  ·  ')}</span>
        ) : null}
        <button className="button button--primary" disabled={erd.saving} onClick={erd.save} type="button">
          {erd.saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="erd-canvas-host" ref={canvas}>
        <ErdCanvas
          layout={erd.layout}
          model={erd.model}
          onMove={erd.move}
          onSelect={erd.setSelected}
          onView={erd.setView}
          selected={erd.selected}
          view={erd.view}
        />
      </div>
    </div>
  )
}
