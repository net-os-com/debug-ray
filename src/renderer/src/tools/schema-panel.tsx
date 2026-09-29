import { useEffect, useState } from 'react'
import type { AppRoute, SchemaTable } from '../../../shared/tools'
import { fileSize, methodColor, type SchemaState } from './use-schema'

type Tab = 'routes' | 'tables'

export function SchemaPanel({ schema, tenants }: { schema: SchemaState; tenants: string[] }) {
  const [tab, setTab] = useState<Tab>('routes')

  // Opening the tab is the request; the tables are a second or two away.
  useEffect(() => {
    if (tab === 'tables' && schema.tables.length === 0 && !schema.loading) {
      void schema.loadTables()
    }
  }, [tab, schema])

  return (
    <section className="artisan">
      <div className="artisan__head">
        <div className="artisan__title">
          <span className="artisan__name">Schema</span>
          <span className="artisan__description">
            {tab === 'routes'
              ? `${schema.routes.length} routes`
              : schema.loading
                ? 'Reading the schema…'
                : `${schema.tables.length} tables on ${schema.tenant === '' ? 'central' : schema.tenant}`}
          </span>
        </div>

        <div className="tools__tabs">
          {(['routes', 'tables'] as Tab[]).map((key) => (
            <button
              className={key === tab ? 'tools__tab tools__tab--on' : 'tools__tab'}
              key={key}
              onClick={() => setTab(key)}
              type="button"
            >
              {key === 'routes' ? 'Routes' : 'Tables'}
            </button>
          ))}
        </div>

        <input
          className="tools__select"
          data-find="schema"
          onChange={(event) => schema.setQuery(event.target.value)}
          placeholder={tab === 'routes' ? 'Search routes' : 'Search tables and columns'}
          value={schema.query}
        />

        {tab === 'tables' ? (
          <>
            <select
              className="tools__select"
              onChange={(event) => schema.setTenant(event.target.value)}
              value={schema.tenant}
            >
              <option value="">Central</option>
              {tenants.map((tenant) => (
                <option key={tenant} value={tenant}>
                  {tenant}
                </option>
              ))}
            </select>

            <button
              className="button button--primary"
              disabled={schema.loading}
              onClick={() => void schema.loadTables()}
              type="button"
            >
              {schema.loading ? 'Reading' : 'Reload'}
            </button>
          </>
        ) : null}
      </div>

      <div className="tests">
        {tab === 'routes' ? <Routes schema={schema} /> : <Tables schema={schema} />}
      </div>
    </section>
  )
}

function Routes({ schema }: { schema: SchemaState }) {
  if (schema.shownRoutes.length === 0) {
    return (
      <div className="scout__empty">
        {schema.routes.length === 0 ? 'No routes were reported.' : `Nothing matches “${schema.query}”`}
      </div>
    )
  }

  return (
    <>
      {schema.shownRoutes.map((route) => (
        <RouteRow key={`${route.methods.join()}:${route.uri}:${route.name}`} route={route} schema={schema} />
      ))}
    </>
  )
}

function RouteRow({ route, schema }: { route: AppRoute; schema: SchemaState }) {
  const key = `${route.methods.join()}:${route.uri}`
  const open = schema.open === key

  return (
    <div className="tests__file">
      <div className="tests__row" onClick={() => schema.toggle(key)}>
        <span className="routes__methods">
          {route.methods.map((method) => (
            <span key={method} style={{ color: methodColor(method) }}>
              {method}
            </span>
          ))}
        </span>

        <span className="routes__uri">
          {/* A {parameter} is the part of a URI worth picking out. */}
          {route.uri.split(/(\{[^}]+\})/).map((part, index) =>
            part.startsWith('{') ? (
              <em className="routes__param" key={index}>
                {part}
              </em>
            ) : (
              part
            ),
          )}
        </span>

        <span className="routes__controller" title={route.action}>
          {route.controller}
        </span>
      </div>

      {open ? (
        <div className="routes__detail">
          {route.name === '' ? null : (
            <div>
              <span className="routes__label">name</span> {route.name}
            </div>
          )}
          <div>
            <span className="routes__label">action</span> {route.action}
          </div>
          <div>
            <span className="routes__label">middleware</span>{' '}
            {route.middleware.length === 0 ? '—' : route.middleware.join(', ')}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Tables({ schema }: { schema: SchemaState }) {
  if (schema.shownTables.length === 0) {
    return (
      <div className="scout__empty">
        {schema.loading
          ? 'Reading the schema…'
          : schema.tables.length === 0
            ? 'No tables on this connection.'
            : `Nothing matches “${schema.query}”`}
      </div>
    )
  }

  return (
    <>
      {schema.shownTables.map((table) => (
        <TableRow key={table.name} schema={schema} table={table} />
      ))}
    </>
  )
}

function TableRow({ table, schema }: { table: SchemaTable; schema: SchemaState }) {
  const open = schema.open === table.name

  return (
    <div className="tests__file">
      <div className="tests__row" onClick={() => schema.toggle(table.name)}>
        <button className="tests__disclose" type="button">
          {open ? '▾' : '▸'}
        </button>
        <span className="tests__name">{table.name}</span>
        <span className="tests__count">{table.columns.length} cols</span>
        <span className="tests__count">
          {table.rows === null ? '—' : `≈ ${table.rows.toLocaleString()} rows`}
        </span>
        <span className="tests__count">{fileSize(table.size)}</span>
      </div>

      {open ? (
        <div className="schema__detail">
          {table.error === null ? null : <div className="scout__note">{table.error}</div>}

          <table className="scout__table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Type</th>
                <th>Null</th>
                <th>Default</th>
                <th>References</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((column) => {
                const key = table.keys.find((one) => one.columns.includes(column.name))

                return (
                  <tr key={column.name}>
                    <td className="scout__model">
                      {column.name}
                      {table.indexes.some(
                        (index) => index.primary && index.columns.includes(column.name),
                      ) ? (
                        <span className="scout__flag">pk</span>
                      ) : null}
                      {table.indexes.some(
                        (index) => index.unique && !index.primary && index.columns.includes(column.name),
                      ) ? (
                        <span className="scout__flag">unique</span>
                      ) : null}
                    </td>
                    <td className="scout__index">{column.type}</td>
                    <td className="scout__index">{column.nullable ? 'null' : ''}</td>
                    <td className="scout__index">{column.default ?? ''}</td>
                    <td className="scout__index">
                      {key === undefined
                        ? ''
                        : `${key.table}.${key.foreignColumns.join(', ')}${key.onDelete === '' || key.onDelete === 'no action' ? '' : ` · on delete ${key.onDelete}`}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {table.indexes.length === 0 ? null : (
            <div className="schema__indexes">
              {table.indexes.map((index) => (
                <span className="chips__one" key={index.name} title={index.name}>
                  {index.primary ? 'primary' : index.unique ? 'unique' : 'index'} ·{' '}
                  {index.columns.join(', ')}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
