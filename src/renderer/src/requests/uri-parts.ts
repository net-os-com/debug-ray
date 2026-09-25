/**
 * A filtered index URL carries more query string than path, which pushed the
 * request list wide enough to swallow the window. Titles show the path; the
 * query is kept, but shown where it cannot dictate layout.
 */
export function pathOf(uri: string): string {
  const mark = uri.indexOf('?')

  return mark === -1 ? uri : uri.slice(0, mark)
}

export function queryOf(uri: string): string | null {
  const mark = uri.indexOf('?')

  return mark === -1 ? null : uri.slice(mark + 1)
}

/** Percent-encoded bracket filters are unreadable; show them decoded. */
export function readableQuery(uri: string): string | null {
  const query = queryOf(uri)

  if (query === null) {
    return null
  }

  try {
    return decodeURIComponent(query)
  } catch {
    return query
  }
}
