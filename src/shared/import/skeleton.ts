/**
 * A JSON schema, turned into something you can send.
 *
 * Not a validator and not a generator: each property becomes one plausible
 * value of its type, so the body that lands in the editor has the right shape
 * and is obviously a placeholder. An `example` in the schema wins over a made
 * up one, because somebody wrote that on purpose.
 */

/** How deep a nested schema is followed before it is left as an empty object. */
const MAX_DEPTH = 6

/**
 * How a `$ref` is followed, and what has been followed already.
 *
 * Generated specs name almost every body — `#/components/schemas/Pet` — and a
 * schema that is only a reference is the normal case, not the exception. They
 * also refer to each other in circles, so each pointer is expanded once per
 * branch and then left as an empty object rather than followed forever.
 */
type Refs = {
  document: Record<string, unknown>
  open: Set<string>
}

export function skeletonOf(
  schema: Record<string, unknown>,
  depth = 0,
  refs: Refs | null = null,
): unknown {
  const pointer = text(schema.$ref)

  if (pointer !== '') {
    if (refs === null || refs.open.has(pointer)) {
      return {}
    }

    const target = follow(refs.document, pointer)

    if (!isRecord(target)) {
      return {}
    }

    refs.open.add(pointer)
    const built = skeletonOf(target, depth, refs)
    refs.open.delete(pointer)

    return built
  }

  if ('example' in schema) {
    return schema.example
  }

  if ('default' in schema) {
    return schema.default
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return schema.enum[0]
  }

  // allOf is the common one: a merge of several schemas, where the properties
  // of each are what the body actually needs.
  for (const key of ['allOf', 'oneOf', 'anyOf'] as const) {
    const branch = schema[key]

    if (Array.isArray(branch) && branch.length > 0) {
      return combined(branch, key, depth, refs)
    }
  }

  if (depth >= MAX_DEPTH) {
    return {}
  }

  switch (typeOf(schema)) {
    case 'object':
      return object(schema, depth, refs)

    case 'array':
      return [isRecord(schema.items) ? skeletonOf(schema.items, depth + 1, refs) : {}]

    case 'integer':
    case 'number':
      return 0

    case 'boolean':
      return false

    case 'null':
      return null

    default:
      return string(schema)
  }
}

function combined(schemas: unknown[], key: string, depth: number, refs: Refs | null): unknown {
  if (key !== 'allOf') {
    // One of several shapes: the first is as good a starting point as any, and
    // choosing between them would be guessing.
    return isRecord(schemas[0]) ? skeletonOf(schemas[0], depth, refs) : {}
  }

  let merged: Record<string, unknown> = {}

  for (const one of schemas) {
    const part = isRecord(one) ? skeletonOf(one, depth, refs) : null

    if (isRecord(part)) {
      merged = { ...merged, ...part }
    }
  }

  return merged
}

function object(
  schema: Record<string, unknown>,
  depth: number,
  refs: Refs | null,
): Record<string, unknown> {
  const properties = isRecord(schema.properties) ? schema.properties : {}
  const out: Record<string, unknown> = {}

  for (const [name, property] of Object.entries(properties)) {
    if (isRecord(property)) {
      out[name] = skeletonOf(property, depth + 1, refs)
    }
  }

  return out
}

/** `#/components/schemas/Pet` → that node, or nothing when it is not there. */
function follow(document: Record<string, unknown>, pointer: string): unknown {
  if (!pointer.startsWith('#/')) {
    // A reference into another file: this app reads one document, so there is
    // nothing to follow.
    return null
  }

  let at: unknown = document

  for (const raw of pointer.slice(2).split('/')) {
    const step = raw.replaceAll('~1', '/').replaceAll('~0', '~')

    if (!isRecord(at)) {
      return null
    }

    at = at[step]
  }

  return at
}

/** A resolver bound to one document, for the schemas inside it. */
export function refsOf(document: Record<string, unknown>): Refs {
  return { document, open: new Set() }
}

function string(schema: Record<string, unknown>): string {
  switch (typeof schema.format === 'string' ? schema.format.toLowerCase() : '') {
    case 'date-time':
      return '2026-01-01T09:00:00Z'

    case 'date':
      return '2026-01-01'

    case 'email':
      return 'name@example.com'

    case 'uuid':
      return '00000000-0000-0000-0000-000000000000'

    case 'uri':
    case 'url':
      return 'https://example.com'

    default:
      return ''
  }
}

function typeOf(schema: Record<string, unknown>): string {
  const type = schema.type

  // OpenAPI 3.1 allows a list of types, nullable ones especially.
  if (Array.isArray(type)) {
    return type.find((one): one is string => typeof one === 'string' && one !== 'null') ?? 'null'
  }

  if (typeof type === 'string') {
    return type
  }

  return 'properties' in schema ? 'object' : 'string'
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function text(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim()
    : ''
}
