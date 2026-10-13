import { useState } from 'react'
import { eloquentRelations, modelName } from './eloquent'
import { CloseIcon, PlusIcon } from './icons'
import { groupColorOf, headerColorOf, SWATCHES, type ErdColumn, type ErdModel, type ErdTable } from './model'
import { setGroup } from './group-patch'
import {
  addColumn,
  deleteColumn,
  renameColumn,
  retypeColumn,
  setColumnDefault,
  setColumnFlags,
  setColumnNote,
  setHeaderColor,
  type PatchResult,
} from './patch'

/** The types the form offers, before the document's own enums are added. */
const TYPES = [
  'bigint',
  'int',
  'smallint',
  'tinyint',
  'varchar(255)',
  'char(36)',
  'text',
  'boolean',
  'timestamp',
  'datetime',
  'date',
  'json',
  'decimal(10,2)',
  'uuid',
]

type InspectorProps = {
  model: ErdModel
  table: ErdTable
  code: string
  /** The column whose form is open, if any. */
  editing: string | null
  onEditing: (column: string | null) => void
  onCode: (code: string) => void
  onClose: () => void
  /** Opens this table's rows in the other views. */
  onTinker: (snippet: string) => void
  onRequests: (table: string) => void
}

/**
 * Everything about one table that does not fit on its card.
 *
 * Every control writes through the patcher rather than through the model: the
 * DBML source is the record, so a refused patch leaves the document exactly as
 * it was and says why, instead of the canvas and the text drifting apart.
 */
export function Inspector({
  model,
  table,
  code,
  editing,
  onEditing,
  onCode,
  onClose,
  onTinker,
  onRequests,
}: InspectorProps) {
  const [refused, setRefused] = useState<string | null>(null)
  const relations = eloquentRelations(model, table)
  const crossDatabase = model.relations.some(
    (one) => one.crossDatabase && (one.from.table === table.name || one.to.table === table.name),
  )

  const apply = (result: PatchResult): void => {
    if (result.ok) {
      setRefused(null)
      onCode(result.code)

      return
    }

    setRefused(result.reason)
  }

  const lines = code.split('\n').length
  // At most one, because DBML refuses a second; read from the model rather than
  // tracked, so it follows the source when the editor is typed in directly.
  const group = model.groups.find((one) => one.tables.includes(table.name))?.name ?? null

  return (
    <div className="erd-inspector" onPointerDown={(event) => event.stopPropagation()}>
      <div className="erd-inspector__head">
        <div className="erd-inspector__title">
          <div className="erd-inspector__name">{table.name}</div>
          <div className="erd-inspector__meta">
            {table.scope} · {table.columns.length} columns · {lines} lines
          </div>
        </div>
        <button className="erd-inspector__close" onClick={onClose} title="Close" type="button">
          <CloseIcon />
        </button>
      </div>

      <div className="erd-inspector__body">
        {refused === null ? null : <div className="erd-inspector__refused">{refused}</div>}

        {table.note === null ? null : <div className="erd-inspector__note">{table.note}</div>}

        {crossDatabase ? (
          <div className="erd-inspector__cross">
            References a table in another database. MySQL can&rsquo;t enforce this foreign key;
            check it in code.
          </div>
        ) : null}

        <section>
          <div className="erd-inspector__heading">Header color</div>
          <div className="erd-inspector__swatches">
            {SWATCHES.map((hex) => (
              <button
                className={
                  headerColorOf(table) === hex
                    ? 'erd-inspector__swatch erd-inspector__swatch--on'
                    : 'erd-inspector__swatch'
                }
                key={hex}
                onClick={() => apply(setHeaderColor(code, table.name, hex))}
                style={{ background: hex }}
                title={hex}
                type="button"
              />
            ))}
            {table.headerColor === null ? null : (
              <button
                className="button erd-inspector__reset"
                onClick={() => apply(setHeaderColor(code, table.name, null))}
                type="button"
              >
                Reset
              </button>
            )}
          </div>
        </section>

        <section>
          <div className="erd-inspector__heading">Table group</div>
          <div className="erd-inspector__groups">
            {[null, ...model.groups.map((one) => one.name)].map((name) => (
              <button
                className={
                  name === group ? 'erd-inspector__group erd-inspector__group--on' : 'erd-inspector__group'
                }
                key={name ?? ''}
                onClick={() => apply(setGroup(code, table.name, name))}
                type="button"
              >
                {name === null ? (
                  'No group'
                ) : (
                  <>
                    <span
                      className="erd-inspector__group-dot"
                      style={{ background: colorOfGroup(model, name) }}
                    />
                    {name}
                  </>
                )}
              </button>
            ))}
            <button
              className="erd-inspector__group erd-inspector__group--new"
              onClick={() => {
                const name = window.prompt('Name the new group')?.trim()

                if (name !== undefined && name !== '') {
                  apply(setGroup(code, table.name, name))
                }
              }}
              type="button"
            >
              <PlusIcon />
              New group
            </button>
          </div>
        </section>

        <section>
          <div className="erd-inspector__heading erd-inspector__heading--row">
            <span>Columns</span>
            <button
              className="button erd-inspector__add"
              onClick={() =>
                apply(
                  addColumn(code, table.name, {
                    name: nextColumnName(table),
                    type: 'varchar(255)',
                    nullable: true,
                    primary: false,
                    unique: false,
                    increment: false,
                    defaultValue: null,
                    note: null,
                    references: null,
                  }),
                )
              }
              type="button"
            >
              <PlusIcon />
              Add
            </button>
          </div>
          <div className="erd-inspector__columns">
            {table.columns.map((column) => (
              <ColumnRow
                code={code}
                column={column}
                enums={model.enums.map((one) => one.name)}
                key={column.name}
                onApply={apply}
                onToggle={() => onEditing(editing === column.name ? null : column.name)}
                open={editing === column.name}
                onRetarget={(next) => onEditing(next)}
                table={table.name}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="erd-inspector__heading">Eloquent relations · {modelName(table)}</div>
          {relations.length === 0 ? (
            <div className="erd-inspector__none">No relations</div>
          ) : (
            <div className="erd-inspector__relations">
              {relations.map((relation) => (
                <button
                  className="erd-inspector__relation"
                  key={`${relation.method}:${relation.signature}`}
                  onClick={() =>
                    onTinker(`${modelName(table)}::with('${relation.method}')->first();`)
                  }
                  title="Try in Tinker"
                  type="button"
                >
                  <span className="erd-inspector__relation-head">
                    <span className="erd-inspector__method">{relation.method}</span>
                    {relation.crossDatabase ? (
                      <span className="erd-inspector__tag">cross-database</span>
                    ) : null}
                  </span>
                  <span className="erd-inspector__signature">{relation.signature}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {table.indexes.length === 0 ? null : (
          <section>
            <div className="erd-inspector__heading">Indexes</div>
            {table.indexes.map((index) => (
              <div className="erd-inspector__index" key={`${index.name}:${index.columns.join()}`}>
                <span>{index.columns.join(', ')}</span>
                <span className="erd-inspector__kind">{index.unique ? 'unique' : 'index'}</span>
              </div>
            ))}
          </section>
        )}

        <div className="erd-inspector__actions">
          <button
            className="button"
            onClick={() => onTinker(`${modelName(table)}::first();`)}
            type="button"
          >
            <span className="erd-inspector__mono">{modelName(table)}::first()</span> in Tinker
          </button>
          <button className="button" onClick={() => onRequests(table.name)} type="button">
            Queries on {table.label} in Requests
          </button>
        </div>
      </div>

      <datalist id="erd-types">
        {[...TYPES, ...model.enums.map((one) => one.name)].map((one) => (
          <option key={one} value={one} />
        ))}
      </datalist>
    </div>
  )
}

type ColumnRowProps = {
  code: string
  table: string
  column: ErdColumn
  enums: string[]
  open: boolean
  onToggle: () => void
  onRetarget: (column: string) => void
  onApply: (result: PatchResult) => void
}

function ColumnRow({
  code,
  table,
  column,
  open,
  onToggle,
  onRetarget,
  onApply,
}: ColumnRowProps) {
  return (
    <div className={open ? 'erd-col erd-col--open' : 'erd-col'}>
      <button className="erd-col__head" onClick={onToggle} type="button">
        <span className="erd-col__name" style={{ fontWeight: column.primary ? 600 : 400 }}>
          {column.name}
        </span>
        <span className="erd-col__flags">{flagsOf(column)}</span>
        <span className="erd-col__type">{column.type}</span>
      </button>

      {open ? (
        <div className="erd-col__form">
          <div className="erd-col__pair">
            <label>
              Name
              <input
                defaultValue={column.name}
                key={`name:${column.name}`}
                onBlur={(event) => {
                  const next = event.target.value.trim()

                  if (next !== '' && next !== column.name) {
                    onApply(renameColumn(code, table, column.name, next))
                    onRetarget(next)
                  }
                }}
                spellCheck={false}
              />
            </label>
            <label>
              Type
              <input
                defaultValue={column.type}
                key={`type:${column.name}:${column.type}`}
                list="erd-types"
                onBlur={(event) => {
                  const next = event.target.value.trim()

                  if (next !== '' && next !== column.type) {
                    onApply(retypeColumn(code, table, column.name, next))
                  }
                }}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="erd-col__toggles">
            {(
              [
                ['primary', 'pk', column.primary],
                ['unique', 'unique', column.unique],
                ['nullable', 'null', column.nullable],
              ] as const
            ).map(([key, label, on]) => (
              <button
                className={on ? 'erd-col__flag erd-col__flag--on' : 'erd-col__flag'}
                key={key}
                onClick={() => onApply(setColumnFlags(code, table, column.name, { [key]: !on }))}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <label className="erd-col__field">
            Default
            <input
              defaultValue={column.defaultValue ?? ''}
              key={`default:${column.name}:${column.defaultValue}`}
              onBlur={(event) => {
                const next = event.target.value.trim()

                if (next !== (column.defaultValue ?? '')) {
                  onApply(setColumnDefault(code, table, column.name, next === '' ? null : next))
                }
              }}
              placeholder="none"
              spellCheck={false}
            />
          </label>

          <label className="erd-col__field">
            Note
            <input
              defaultValue={column.note ?? ''}
              key={`note:${column.name}:${column.note}`}
              onBlur={(event) => {
                const next = event.target.value.trim()

                if (next !== (column.note ?? '')) {
                  onApply(setColumnNote(code, table, column.name, next === '' ? null : next))
                }
              }}
              placeholder="Shown as tooltip and comment"
            />
          </label>

          {column.references === null ? null : (
            <div className="erd-col__ref">
              Reference{' '}
              <span className="erd-inspector__mono">
                {column.references.table}.{column.references.column}
              </span>{' '}
              · edit in code
            </div>
          )}

          <div className="erd-col__actions">
            <button
              className="button erd-col__delete"
              onClick={() => {
                onApply(deleteColumn(code, table, column.name))
                onRetarget('')
              }}
              type="button"
            >
              Delete column
            </button>
            <button className="button button--primary" onClick={onToggle} type="button">
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function flagsOf(column: ErdColumn): string {
  const flags: string[] = []

  if (column.primary) {
    flags.push('pk')
  }

  if (column.increment) {
    flags.push('auto')
  }

  if (column.unique) {
    flags.push('unique')
  }

  if (!column.nullable) {
    flags.push('not null')
  }

  return flags.join(' · ')
}

/** A name no column in this table already has. */
function nextColumnName(table: ErdTable): string {
  const taken = new Set(table.columns.map((column) => column.name))
  let index = 1

  while (taken.has(`column_${index}`)) {
    index += 1
  }

  return `column_${index}`
}

/** The colour the canvas draws a group in, so the chip matches the rectangle. */
function colorOfGroup(model: ErdModel, name: string): string {
  const index = model.groups.findIndex((one) => one.name === name)
  const group = model.groups[index]

  return group === undefined ? 'var(--t3)' : groupColorOf(group, index)
}
