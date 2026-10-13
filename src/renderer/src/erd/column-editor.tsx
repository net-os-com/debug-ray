import { useState } from 'react'
import type { ErdColumn } from './model'
import { deleteColumn, renameColumn, retypeColumn, setColumnFlags, type PatchResult } from './patch'

type ColumnEditorProps = {
  code: string
  table: string
  column: ErdColumn
  onCode: (code: string) => void
  /** Points the form at the new name after a rename, so it stays open. */
  onRetarget: (column: string) => void
  onClose: () => void
}

const FLAGS = [
  { key: 'primary', label: 'pk' },
  { key: 'unique', label: 'unique' },
  { key: 'nullable', label: 'null' },
] as const

export function ColumnEditor({ code, table, column, onCode, onRetarget, onClose }: ColumnEditorProps) {
  const [refused, setRefused] = useState<string | null>(null)

  /** Every control goes through here, so a refusal is reported in one place. */
  const apply = (result: PatchResult): void => {
    if (result.ok) {
      setRefused(null)
      onCode(result.code)

      return
    }

    // The text is the record: a refused patch leaves the source as it was.
    setRefused(result.reason)
  }

  return (
    <div className="erd-colform" onPointerDown={(event) => event.stopPropagation()}>
      <div className="erd-colform__head">{table}</div>

      <label className="erd-colform__field">
        Name
        <input
          className="input input--text"
          defaultValue={column.name}
          onBlur={(event) => {
            const next = event.target.value

            if (next === column.name) {
              return
            }

            const result = renameColumn(code, table, column.name, next)

            apply(result)

            // The form finds its column by name; without this it would be
            // looking for one that no longer exists and would close itself.
            if (result.ok) {
              onRetarget(next)
            }
          }}
          type="text"
        />
      </label>

      <label className="erd-colform__field">
        Type
        <input
          className="input input--text"
          defaultValue={column.type}
          onBlur={(event) => {
            if (event.target.value !== column.type) {
              apply(retypeColumn(code, table, column.name, event.target.value))
            }
          }}
          type="text"
        />
      </label>

      <div className="erd-colform__flags">
        {FLAGS.map((flag) => (
          <button
            className={column[flag.key] ? 'chip chip--on' : 'chip'}
            key={flag.key}
            onClick={() =>
              apply(setColumnFlags(code, table, column.name, { [flag.key]: !column[flag.key] }))
            }
            type="button"
          >
            {flag.label}
          </button>
        ))}
      </div>

      {refused === null ? null : <div className="erd-colform__refused">{refused}</div>}

      <div className="erd-colform__actions">
        <button
          className="button"
          onClick={() => {
            const result = deleteColumn(code, table, column.name)

            apply(result)

            // Closing on a refusal would unmount the form and take the reason
            // with it: the column would still be there with nothing said.
            if (result.ok) {
              onClose()
            }
          }}
          type="button"
        >
          Delete column
        </button>
        <button className="button button--primary" onClick={onClose} type="button">
          Done
        </button>
      </div>
    </div>
  )
}
