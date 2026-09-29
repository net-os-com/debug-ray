import type { ValueNode } from '../../../shared/tinker'

export type Tone = 'class' | 'string' | 'number' | 'bool' | 'null' | 'plain' | 'muted'

export type TreeRow = {
  /** Identifies the row for collapsing; stable as long as the value is. */
  path: string
  depth: number
  /** `"email" => `, or empty at the root and on closing brackets. */
  key: string
  value: string
  tone: Tone
  suffix: string
  toggle: boolean
  open: boolean
}

/** What the header prints next to the timing. */
export function typeLabel(node: ValueNode): string {
  switch (node.t) {
    case 'obj':
    case 'ref':
      return node.cls
    case 'arr':
      return `array:${node.kids.length + (node.more ?? 0)}`
    case 'str':
      return 'string'
    case 'num':
      return Number.isInteger(node.v) ? 'int' : 'float'
    case 'bool':
      return 'bool'
    default:
      return 'null'
  }
}

/**
 * Turns the tree into the flat list of rows the pane draws.
 *
 * Collapsed branches contribute one row that says what is inside, so closing a
 * model does not make it disappear.
 */
export function flatten(node: ValueNode, collapsed: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = []

  walk(node, '', 'root', 0, collapsed, rows)

  return rows
}

/** Every branch, so Collapse can close them all at once. */
export function branchPaths(node: ValueNode): string[] {
  const paths: string[] = []

  const visit = (current: ValueNode, path: string): void => {
    if (current.t !== 'obj' && current.t !== 'arr') {
      return
    }

    paths.push(path)
    current.kids.forEach(([, child], index) => visit(child, `${path}.${index}`))
  }

  visit(node, 'root')

  return paths
}

function walk(
  node: ValueNode,
  key: string,
  path: string,
  depth: number,
  collapsed: ReadonlySet<string>,
  rows: TreeRow[],
): void {
  const label = key === '' ? '' : `${key} => `

  if (node.t === 'obj' || node.t === 'arr') {
    const closed = collapsed.has(path)
    const open = node.t === 'obj' ? `${node.cls} {` : `array:${node.kids.length + (node.more ?? 0)} [`
    const close = node.t === 'obj' ? '}' : ']'

    rows.push({
      path,
      depth,
      key: label,
      value: open,
      tone: node.t === 'obj' ? 'class' : 'plain',
      suffix: (node.t === 'obj' ? `${node.id} ` : '') + (closed ? `… ${close}` : ''),
      toggle: true,
      open: !closed,
    })

    if (closed) {
      return
    }

    node.kids.forEach(([childKey, child], index) =>
      walk(child, childKey, `${path}.${index}`, depth + 1, collapsed, rows),
    )

    if ((node.more ?? 0) > 0) {
      rows.push({
        path: `${path}.more`,
        depth: depth + 1,
        key: '',
        value: `… ${node.more} more`,
        tone: 'muted',
        suffix: '',
        toggle: false,
        open: false,
      })
    }

    rows.push({
      path: `${path}.close`,
      depth,
      key: '',
      value: close,
      tone: 'muted',
      suffix: '',
      toggle: false,
      open: false,
    })

    return
  }

  rows.push({
    path,
    depth,
    key: label,
    value: scalar(node),
    tone: tone(node),
    suffix: node.t === 'str' && node.cut === true ? ' …truncated' : '',
    toggle: false,
    open: false,
  })
}

function scalar(node: ValueNode): string {
  switch (node.t) {
    case 'str':
      return `"${node.v}"`
    case 'num':
      return String(node.v)
    case 'bool':
      return node.v ? 'true' : 'false'
    case 'ref':
      return `${node.cls} ${node.id}`
    default:
      return 'null'
  }
}

function tone(node: ValueNode): Tone {
  switch (node.t) {
    case 'str':
      return 'string'
    case 'num':
      return 'number'
    case 'bool':
      return 'bool'
    case 'ref':
      return 'class'
    default:
      return 'null'
  }
}

/**
 * Branches holding a match anywhere beneath them.
 *
 * Searching a tree that hides most of itself is useless unless the hits come
 * into view, so the pane opens exactly these and leaves the rest as the reader
 * left them.
 */
export function pathsWithMatch(node: ValueNode, needle: string): Set<string> {
  const open = new Set<string>()

  if (needle === '') {
    return open
  }

  const lowered = needle.toLowerCase()

  const visit = (current: ValueNode, key: string, path: string): boolean => {
    if (key.toLowerCase().includes(lowered)) {
      return true
    }

    if (current.t !== 'obj' && current.t !== 'arr') {
      return scalarText(current).toLowerCase().includes(lowered)
    }

    // The class name is part of the row, so an object can match on its own.
    let hit = current.t === 'obj' && current.cls.toLowerCase().includes(lowered)

    current.kids.forEach(([childKey, child], index) => {
      if (visit(child, childKey, `${path}.${index}`)) {
        hit = true
      }
    })

    if (hit) {
      open.add(path)
    }

    return hit
  }

  visit(node, '', 'root')

  return open
}

/** Whether a drawn row is one of the hits, so it can be marked. */
export function rowMatches(row: TreeRow, needle: string): boolean {
  if (needle === '') {
    return false
  }

  const lowered = needle.toLowerCase()

  return (
    row.key.toLowerCase().includes(lowered) || row.value.toLowerCase().includes(lowered)
  )
}

/**
 * Splits text around every occurrence of the needle, so the hits can be given
 * a mark and the rest left alone.
 */
export function segments(text: string, needle: string): { text: string; hit: boolean }[] {
  if (needle === '' || text === '') {
    return [{ text, hit: false }]
  }

  const lowered = text.toLowerCase()
  const target = needle.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []

  let cursor = 0

  for (let at = lowered.indexOf(target); at !== -1; at = lowered.indexOf(target, cursor)) {
    if (at > cursor) {
      parts.push({ text: text.slice(cursor, at), hit: false })
    }

    parts.push({ text: text.slice(at, at + needle.length), hit: true })
    cursor = at + needle.length
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hit: false })
  }

  return parts
}

function scalarText(node: ValueNode): string {
  switch (node.t) {
    case 'str':
      return node.v
    case 'num':
      return String(node.v)
    case 'bool':
      return node.v ? 'true' : 'false'
    case 'ref':
      return node.cls
    default:
      return 'null'
  }
}
