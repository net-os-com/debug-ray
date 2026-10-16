export type JsonRow = {
  indent: number
  key: string
  value: string
  kind: 'string' | 'number' | 'boolean' | 'null' | 'punctuation'
}

/**
 * Flattens a payload into printable rows.
 *
 * A flat list rather than a nested component tree because the rows are what
 * gets measured, scrolled and coloured, and nesting them would make every one
 * of those three jobs harder for no gain in what the reader sees.
 */
export function jsonRows(data: unknown): JsonRow[] {
  if (data === null || typeof data !== 'object') {
    return [{ indent: 0, key: '', value: text(data), kind: kindOf(data) }]
  }

  const rows: JsonRow[] = []
  const top = Array.isArray(data)

  rows.push({ indent: 0, key: '', value: top ? '[' : '{', kind: 'punctuation' })
  walk(data as Record<string, unknown>, 1, top, rows)
  rows.push({ indent: 0, key: '', value: top ? ']' : '}', kind: 'punctuation' })

  return rows
}

function walk(value: object, depth: number, inArray: boolean, rows: JsonRow[]): void {
  const entries: [string, unknown][] = Array.isArray(value)
    ? value.map((one, index) => [String(index), one])
    : Object.entries(value)

  entries.forEach(([name, child], index) => {
    const comma = index < entries.length - 1 ? ',' : ''
    const key = inArray ? '' : `"${name}": `

    if (child !== null && typeof child === 'object') {
      const array = Array.isArray(child)

      rows.push({ indent: depth, key, value: array ? '[' : '{', kind: 'punctuation' })
      walk(child, depth + 1, array, rows)
      rows.push({ indent: depth, key: '', value: `${array ? ']' : '}'}${comma}`, kind: 'punctuation' })

      return
    }

    rows.push({ indent: depth, key, value: `${text(child)}${comma}`, kind: kindOf(child) })
  })
}

function text(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value)
}

function kindOf(value: unknown): JsonRow['kind'] {
  if (typeof value === 'string') {
    return 'string'
  }

  if (typeof value === 'number') {
    return 'number'
  }

  if (typeof value === 'boolean') {
    return 'boolean'
  }

  return 'null'
}
