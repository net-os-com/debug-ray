import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TinkerContainer } from '../../../shared/tinker'
import type { AppRoute, SchemaTable } from '../../../shared/tools'

export type SchemaState = ReturnType<typeof useSchema>

export function useSchema(container: TinkerContainer | null, tenants: string[]) {
  const [routes, setRoutes] = useState<AppRoute[]>([])
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [tenant, setTenant] = useState('')
  /** Until you pick one, the panel may choose a better default than central. */
  const [chosen, setChosen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (container === null) {
      return
    }

    setRoutes([])
    void window.ray.getRoutes(container.id, container.workingDir).then(setRoutes)
  }, [container])

  /*
   * Under multi-database tenancy the application's own tables live in a
   * tenant's database; central holds the framework's and the tenant registry.
   * Landing on central shows eighteen tables and none of the ones you came for.
   */
  useEffect(() => {
    if (!chosen && tenant === '' && tenants.length > 0) {
      setTenant(tenants[0] as string)
    }
  }, [chosen, tenant, tenants])

  const loadTables = useCallback(async () => {
    if (container === null) {
      return
    }

    setLoading(true)

    try {
      setTables(await window.ray.getSchemaTables(container.id, container.workingDir, tenant))
    } finally {
      setLoading(false)
    }
  }, [container, tenant])

  const shownRoutes = useMemo(() => filterRoutes(routes, query), [routes, query])
  const shownTables = useMemo(() => filterTables(tables, query), [tables, query])

  return {
    routes,
    tables,
    shownRoutes,
    shownTables,
    tenant,
    setTenant: useCallback((next: string) => {
      setChosen(true)
      setTenant(next)
      setTables([])
    }, []),
    loading,
    query,
    setQuery,
    open,
    toggle: useCallback((key: string) => setOpen((current) => (current === key ? null : key)), []),
    loadTables,
  }
}

export function filterRoutes(routes: AppRoute[], query: string): AppRoute[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return routes
  }

  return routes.filter((route) =>
    `${route.methods.join(' ')} ${route.uri} ${route.name} ${route.action}`
      .toLowerCase()
      .includes(needle),
  )
}

/** Matches a table by its name and by any column in it. */
export function filterTables(tables: SchemaTable[], query: string): SchemaTable[] {
  const needle = query.trim().toLowerCase()

  if (needle === '') {
    return tables
  }

  return tables.filter(
    (table) =>
      table.name.toLowerCase().includes(needle) ||
      table.columns.some((column) => column.name.toLowerCase().includes(needle)),
  )
}

const UNITS = ['B', 'KB', 'MB', 'GB']

export function fileSize(bytes: number): string {
  let size = bytes
  let unit = 0

  while (size >= 1_024 && unit < UNITS.length - 1) {
    size /= 1_024
    unit += 1
  }

  return `${size < 10 && unit > 0 ? size.toFixed(1) : Math.round(size)} ${UNITS[unit]}`
}

/** GET and DELETE should not look alike in a list of two hundred rows. */
export function methodColor(method: string): string {
  if (method === 'GET') {
    return 'var(--ok-fg)'
  }

  if (method === 'DELETE') {
    return 'var(--err-fg)'
  }

  return method === 'POST' || method === 'PUT' || method === 'PATCH'
    ? 'var(--sql-num)'
    : 'var(--t3)'
}
