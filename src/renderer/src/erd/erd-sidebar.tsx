import { enumUses } from './enums'
import { SearchIcon } from './icons'
import { groupColorOf, type ErdModel, type ErdTable } from './model'

/** The scopes the filter offers, in the design's order. */
const SCOPES: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'central', label: 'Central' },
  { key: 'tenant', label: 'Tenant' },
]

type ErdSidebarProps = {
  model: ErdModel
  query: string
  scope: string
  /** Which table the canvas has selected, so the list can mark it. */
  selected: string | null
  onQuery: (query: string) => void
  onScope: (scope: string) => void
  onSelect: (table: string) => void
}

/**
 * The table list, grouped exactly as the source groups it.
 *
 * Tables a `TableGroup` does not name fall into one trailing "Ungrouped"
 * section rather than being left out: a schema with no groups at all would
 * otherwise show an empty sidebar beside a full canvas.
 */
export function ErdSidebar({
  model,
  query,
  scope,
  selected,
  onQuery,
  onScope,
  onSelect,
}: ErdSidebarProps) {
  const sections = sidebarGroups(model)
  const enums = enumUses(model).filter((use) => use.columns.length > 0 || true)
  const matches = (table: ErdTable): boolean =>
    (query.trim() === '' || table.name.toLowerCase().includes(query.trim().toLowerCase())) &&
    (scope === '' || table.scope === scope)

  return (
    <aside className="erd-side">
      <div className="erd-side__head">
        <div className="erd-side__search">
          <SearchIcon />
          <input
            data-find="erd"
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Find table"
            value={query}
          />
        </div>
        <div className="erd-side__scopes">
          {SCOPES.map((one) => (
            <button
              className={scope === one.key ? 'erd-side__scope erd-side__scope--on' : 'erd-side__scope'}
              key={one.key}
              onClick={() => onScope(one.key)}
              type="button"
            >
              {one.label}
            </button>
          ))}
        </div>
      </div>

      <div className="erd-side__body">
        {model.tables.length === 0 ? (
          <div className="erd-side__empty">
            Tables you define in DBML show up here, grouped by TableGroup.
          </div>
        ) : null}

        {sections.map((section) => (
          <div className="erd-side__group" key={section.name}>
            <div className="erd-side__title">
              <span className="erd-side__dot" style={{ background: section.color }} />
              <span className="erd-side__label">{section.name}</span>
              <span className="erd-side__count">{section.tables.length}</span>
            </div>
            {section.tables.map((table) => (
              <button
                className={
                  selected === table.name ? 'erd-side__row erd-side__row--on' : 'erd-side__row'
                }
                key={table.name}
                onClick={() => onSelect(table.name)}
                style={{ opacity: matches(table) ? 1 : 0.4 }}
                type="button"
              >
                <span className="erd-side__name">{table.label}</span>
                <span className="erd-side__scope-tag">{table.scope}</span>
              </button>
            ))}
          </div>
        ))}

        {model.enums.length === 0 ? null : (
          <>
            <div className="erd-side__heading">Enums</div>
            {enums.map((use) => (
              <div className="erd-side__enum" key={use.enum.name} title={use.enum.values.join(', ')}>
                <span className="erd-side__enum-name">{use.enum.name}</span>
                <span className="erd-side__count">{use.columns.length}</span>
              </div>
            ))}
          </>
        )}

        {model.notes.length === 0 ? null : (
          <>
            <div className="erd-side__heading">Notes</div>
            {model.notes.map((note) => (
              <div className="erd-side__note" key={note.name} title={note.text}>
                {note.name}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}

type Section = { name: string; color: string; tables: ErdTable[] }

function sidebarGroups(model: ErdModel): Section[] {
  const byName = new Map(model.tables.map((table) => [table.name, table]))
  const grouped = new Set<string>()
  const sections: Section[] = []

  model.groups.forEach((group, index) => {
    const tables = group.tables
      .map((name) => byName.get(name))
      .filter((table): table is ErdTable => table !== undefined)

    tables.forEach((table) => grouped.add(table.name))

    if (tables.length > 0) {
      sections.push({ name: group.name, color: groupColorOf(group, index), tables })
    }
  })

  const rest = model.tables.filter((table) => !grouped.has(table.name))

  if (rest.length > 0) {
    sections.push({ name: 'Ungrouped', color: 'var(--t3)', tables: rest })
  }

  return sections
}
