import { useState } from 'react'

/**
 * A plain JavaScript value as a tree you can fold.
 *
 * `ray()->json()` decodes its argument before sending it, so what arrives is a
 * structure rather than a string — and printing a structure with
 * JSON.stringify gives you back the string you started with, forty screens
 * long, with no way to close the part you are not reading.
 */
type JsonTreeProps = {
  value: unknown
  /** Levels open on arrival. Deeper than this and you are scrolling, not reading. */
  openTo?: number
}

export function JsonTree({ value, openTo = 2 }: JsonTreeProps) {
  return (
    <div className="json-tree">
      <Node depth={0} name={null} openTo={openTo} value={value} />
    </div>
  )
}

type NodeProps = {
  name: string | null
  value: unknown
  depth: number
  openTo: number
}

function Node({ name, value, depth, openTo }: NodeProps) {
  const [open, setOpen] = useState(depth < openTo)
  const entries = childrenOf(value)

  if (entries === null) {
    return (
      <div className="json-tree__row" style={{ paddingLeft: depth * 14 }}>
        {name === null ? null : <span className="json-tree__key">{name}</span>}
        <Leaf value={value} />
      </div>
    )
  }

  const array = Array.isArray(value)
  const summary = `${array ? '[' : '{'}${entries.length}${array ? ']' : '}'}`

  return (
    <>
      <div className="json-tree__row" style={{ paddingLeft: depth * 14 }}>
        <button
          className="json-tree__toggle"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          {open ? '▾' : '▸'}
        </button>
        {name === null ? null : <span className="json-tree__key">{name}</span>}
        <span className="json-tree__summary">{summary}</span>
      </div>

      {open
        ? entries.map(([key, child]) => (
            <Node depth={depth + 1} key={key} name={key} openTo={openTo} value={child} />
          ))
        : null}
    </>
  )
}

function Leaf({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    return <span className="json-tree__string">"{value}"</span>
  }

  if (typeof value === 'number') {
    return <span className="json-tree__number">{String(value)}</span>
  }

  return <span className="json-tree__const">{value === undefined ? 'undefined' : String(value)}</span>
}

/** null for a leaf; the entries to draw underneath for anything else. */
function childrenOf(value: unknown): [string, unknown][] | null {
  if (Array.isArray(value)) {
    return value.map((child, index) => [String(index), child])
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value as Record<string, unknown>)
  }

  return null
}
