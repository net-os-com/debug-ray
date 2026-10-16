/**
 * A subset of JSONPath, enough to narrow a response down to the part of it
 * somebody is actually reading.
 *
 * Hand-written rather than pulled in: the grammar that gets used against a
 * response body is small — a few names, a wildcard, an index, the occasional
 * filter — and what matters more than completeness is that a half-typed path
 * says what is wrong with it instead of quietly matching nothing.
 */

type Step =
  | { kind: 'child'; name: string }
  | { kind: 'wildcard' }
  /** `..name`, or `..*` when the name is null: at any depth below here. */
  | { kind: 'descend'; name: string | null }
  | { kind: 'index'; indices: number[] }
  | { kind: 'slice'; from: number | null; to: number | null; by: number }
  | { kind: 'filter'; field: string[]; op: Operator | null; literal: unknown }

type Operator = '==' | '!=' | '>' | '>=' | '<' | '<='

const OPERATORS: Operator[] = ['==', '!=', '>=', '<=', '>', '<']

export type JsonPathResult = {
  matches: unknown[]
  /** Null when the expression parsed, whether or not it matched anything. */
  error: string | null
}

/**
 * The values an expression selects, in document order.
 *
 * Always a list, even for a path that can only ever match once: `$.data.*.id`
 * and `$.data.0.id` returning different shapes would make the filter box behave
 * differently depending on what you typed into it.
 */
export function queryPath(value: unknown, expression: string): JsonPathResult {
  const trimmed = expression.trim()

  if (trimmed === '') {
    return { matches: [], error: null }
  }

  let steps: Step[]

  try {
    steps = parse(trimmed)
  } catch (error) {
    return { matches: [], error: error instanceof Error ? error.message : 'Invalid path' }
  }

  let current: unknown[] = [value]

  for (const step of steps) {
    current = current.flatMap((one) => apply(one, step))
  }

  return { matches: current, error: null }
}

/* ------------------------------------------------------------------ parsing */

function parse(input: string): Step[] {
  // `data.*.id` is what gets typed when a key path is copied out of a log line,
  // and it means the same thing as `$.data.*.id`. The root is filled in rather
  // than demanded.
  const expression = input.startsWith('$')
    ? input
    : input.startsWith('.') || input.startsWith('[')
      ? `$${input}`
      : `$.${input}`

  let at = 1
  const steps: Step[] = []

  while (at < expression.length) {
    const character = expression[at]

    if (character === '.' && expression[at + 1] === '.') {
      at += 2
      at = descendant(expression, at, steps)

      continue
    }

    if (character === '.') {
      at += 1

      if (expression[at] === '*') {
        steps.push({ kind: 'wildcard' })
        at += 1

        continue
      }

      const name = word(expression, at)

      if (name === '') {
        throw new Error('A dot has to be followed by a name: $.data')
      }

      steps.push({ kind: 'child', name })
      at += name.length

      continue
    }

    if (character === '[') {
      at = bracket(expression, at, steps)

      continue
    }

    throw new Error(`Unexpected “${character}” — a step is .name or [0]`)
  }

  return steps
}

/** `..name`, `..*`, and `..[0]`, which all search below the current node. */
function descendant(expression: string, at: number, steps: Step[]): number {
  if (expression[at] === '*') {
    steps.push({ kind: 'descend', name: null })

    return at + 1
  }

  if (expression[at] === '[') {
    steps.push({ kind: 'descend', name: null })

    return bracket(expression, at, steps)
  }

  const name = word(expression, at)

  if (name === '') {
    throw new Error('A recursive step needs a name: $..id')
  }

  steps.push({ kind: 'descend', name })

  return at + name.length
}

/** Everything between a `[` and its `]`, which is four different things. */
function bracket(expression: string, at: number, steps: Step[]): number {
  const close = closing(expression, at)
  const inside = expression.slice(at + 1, close).trim()

  if (inside === '') {
    throw new Error('Empty [] — say [0], [*], or [“name”]')
  }

  if (inside === '*') {
    steps.push({ kind: 'wildcard' })

    return close + 1
  }

  if (inside.startsWith('?')) {
    steps.push(filter(inside))

    return close + 1
  }

  const quoted = /^['"](.*)['"]$/s.exec(inside)

  if (quoted !== null) {
    steps.push({ kind: 'child', name: quoted[1] ?? '' })

    return close + 1
  }

  if (inside.includes(':')) {
    const parts = inside.split(':')

    if (parts.length > 3) {
      throw new Error('A slice is [from:to] or [from:to:step]')
    }

    steps.push({
      kind: 'slice',
      from: bound(parts[0]),
      to: bound(parts[1]),
      by: bound(parts[2]) ?? 1,
    })

    return close + 1
  }

  const indices = inside.split(',').map((part) => {
    const number = Number(part.trim())

    if (part.trim() === '' || !Number.isInteger(number)) {
      throw new Error(`“${inside}” is not an index, a name in quotes, or a slice`)
    }

    return number
  })

  steps.push({ kind: 'index', indices })

  return close + 1
}

/** `[?(@.status == "open")]`, and `[?(@.status)]` for "has one at all". */
function filter(inside: string): Step {
  const body = /^\?\s*\((.*)\)\s*$/s.exec(inside)

  if (body === null) {
    throw new Error('A filter looks like [?(@.id == 3)]')
  }

  const text = (body[1] ?? '').trim()
  const operator = OPERATORS.find((candidate) => text.includes(candidate)) ?? null

  if (operator === null) {
    return { kind: 'filter', field: fieldPath(text), op: null, literal: null }
  }

  const split = text.indexOf(operator)

  return {
    kind: 'filter',
    field: fieldPath(text.slice(0, split).trim()),
    op: operator,
    literal: literalOf(text.slice(split + operator.length).trim()),
  }
}

/**
 * `@.user.name` → ['user', 'name']; a bare `@` is the item itself.
 *
 * Checked against the whole shape before it is split, so that an operator this
 * does not support — `[?(@.id ~ 3)]` — is an error rather than a lookup of a key
 * named "id ~ 3", which matches nothing and explains nothing.
 */
const FIELD =
  /^@(?:\.[A-Za-z0-9_$-]+|\[\s*'[^']*'\s*\]|\[\s*"[^"]*"\s*\]|\[\s*-?\d+\s*\])*$/

function fieldPath(text: string): string[] {
  if (!text.startsWith('@')) {
    throw new Error('A filter compares the item, which is written @: [?(@.id == 3)]')
  }

  if (!FIELD.test(text)) {
    throw new Error(`“${text}” is not a field — write @.name, and compare with == != < <= > >=`)
  }

  return text
    .slice(1)
    .split(/[.[\]]/)
    .map((part) => part.replace(/^['"]|['"]$/g, '').trim())
    .filter((part) => part !== '')
}

function literalOf(text: string): unknown {
  const quoted = /^['"](.*)['"]$/s.exec(text)

  if (quoted !== null) {
    return quoted[1] ?? ''
  }

  if (text === 'true' || text === 'false') {
    return text === 'true'
  }

  if (text === 'null') {
    return null
  }

  const number = Number(text)

  if (text !== '' && !Number.isNaN(number)) {
    return number
  }

  throw new Error(`“${text}” is not a value — quote it, or write a number`)
}

function closing(expression: string, at: number): number {
  let quote: string | null = null

  for (let index = at + 1; index < expression.length; index += 1) {
    const character = expression[index]

    if (quote !== null) {
      if (character === quote) {
        quote = null
      }

      continue
    }

    if (character === '"' || character === "'") {
      quote = character

      continue
    }

    if (character === ']') {
      return index
    }
  }

  throw new Error('A [ here is never closed')
}

function word(expression: string, at: number): string {
  return /^[A-Za-z0-9_$@-]*/.exec(expression.slice(at))?.[0] ?? ''
}

function bound(part: string | undefined): number | null {
  if (part === undefined || part.trim() === '') {
    return null
  }

  const number = Number(part.trim())

  if (!Number.isInteger(number)) {
    throw new Error('A slice takes whole numbers: [0:5]')
  }

  return number
}

/* --------------------------------------------------------------- evaluating */

function apply(value: unknown, step: Step): unknown[] {
  switch (step.kind) {
    case 'child':
      return child(value, step.name)

    case 'wildcard':
      return children(value)

    case 'descend':
      return descend(value, step.name)

    case 'index': {
      if (!Array.isArray(value)) {
        return []
      }

      return step.indices
        .map((index) => value[index < 0 ? value.length + index : index])
        .filter((one) => one !== undefined)
    }

    case 'slice': {
      if (!Array.isArray(value)) {
        return []
      }

      return slice(value, step)
    }

    case 'filter':
      return children(value).filter((one) => keeps(one, step))
  }
}

function child(value: unknown, name: string): unknown[] {
  if (Array.isArray(value)) {
    // `$.data.0` and `$.data[0]` are the same reach into a list, and the first
    // is what people type when they are copying a key path out of a log line.
    const index = Number(name)

    return Number.isInteger(index) && value[index] !== undefined ? [value[index]] : []
  }

  if (!isRecord(value) || !(name in value)) {
    return []
  }

  return [value[name]]
}

function children(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  return isRecord(value) ? Object.values(value) : []
}

function descend(value: unknown, name: string | null): unknown[] {
  const found: unknown[] = []

  const walk = (node: unknown): void => {
    if (name === null) {
      // `..*` is every value below here, which includes the containers; a
      // reader scanning for "where is that nested thing" wants to see them.
      for (const one of children(node)) {
        found.push(one)
        walk(one)
      }

      return
    }

    if (isRecord(node) && name in node) {
      found.push(node[name])
    }

    for (const one of children(node)) {
      walk(one)
    }
  }

  walk(value)

  return found
}

function slice(value: unknown[], step: Extract<Step, { kind: 'slice' }>): unknown[] {
  const by = step.by === 0 ? 1 : step.by
  const start = step.from === null ? 0 : clamp(step.from, value.length)
  const end = step.to === null ? value.length : clamp(step.to, value.length)
  const out: unknown[] = []

  if (by > 0) {
    for (let index = start; index < end; index += by) {
      out.push(value[index])
    }

    return out
  }

  for (let index = end - 1; index >= start; index += by) {
    out.push(value[index])
  }

  return out
}

function clamp(index: number, length: number): number {
  const resolved = index < 0 ? length + index : index

  return Math.min(Math.max(resolved, 0), length)
}

function keeps(value: unknown, step: Extract<Step, { kind: 'filter' }>): boolean {
  let at: unknown = value

  for (const part of step.field) {
    const next = child(at, part)

    if (next.length === 0) {
      return false
    }

    at = next[0]
  }

  if (step.op === null) {
    return at !== null && at !== undefined && at !== false
  }

  return compare(at, step.op, step.literal)
}

function compare(value: unknown, op: Operator, literal: unknown): boolean {
  // An id that arrives as "3" and a filter that says 3 mean the same thing to
  // the person who typed it, so numbers and numeric strings are compared as
  // numbers rather than missing each other.
  const pair: [unknown, unknown] =
    typeof value === typeof literal
      ? [value, literal]
      : numeric(value) && numeric(literal)
        ? [Number(value), Number(literal)]
        : [String(value), String(literal)]

  switch (op) {
    case '==':
      return pair[0] === pair[1]

    case '!=':
      return pair[0] !== pair[1]

    case '>':
      return greater(pair[0], pair[1])

    case '>=':
      return pair[0] === pair[1] || greater(pair[0], pair[1])

    case '<':
      return greater(pair[1], pair[0])

    case '<=':
      return pair[0] === pair[1] || greater(pair[1], pair[0])
  }
}

function greater(left: unknown, right: unknown): boolean {
  if (typeof left === 'number' && typeof right === 'number') {
    return left > right
  }

  if (typeof left === 'string' && typeof right === 'string') {
    return left > right
  }

  return false
}

function numeric(value: unknown): boolean {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)))
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
