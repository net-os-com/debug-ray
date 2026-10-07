import type { ContractField } from '../../../shared/tools'

/**
 * Rules that mean the field has to be in the body at all.
 *
 * `required_if` and its family are deliberately not here: they demand the field
 * only under a condition this cannot evaluate, so putting them in a starting
 * body would ask for something the request may not want.
 */
const DEMANDED = new Set(['required', 'present', 'filled'])

/**
 * A starting body, built from the DTO the controller takes.
 *
 * Every other client makes you discover the shape of a request by sending an
 * empty one and reading the 422 back. The shape is already in the code here, so
 * the first send can be a real attempt rather than a probe.
 */
export function bodySkeleton(fields: ContractField[], all = false): string {
  const body: Record<string, unknown> = {}

  for (const field of fields) {
    // `roles.*` and `users.*.email` describe what is inside an array rather
    // than a key of their own.
    if (field.name.includes('.')) {
      continue
    }

    if (!all && !isDemanded(field)) {
      continue
    }

    body[field.name] = placeholder(field)
  }

  return JSON.stringify(body, null, 2)
}

export function isDemanded(field: ContractField): boolean {
  return field.rules.some((rule) => DEMANDED.has(rule))
}

/** Something of the right type, so what is left to do is replace the values. */
function placeholder(field: ContractField): unknown {
  const type = field.type.toLowerCase()

  if (type === 'int' || type === 'float' || type === 'integer') {
    return 0
  }

  if (type === 'bool' || type === 'boolean') {
    return false
  }

  if (type === 'array' || type === 'collection') {
    return []
  }

  if (type === 'carbon' || type === 'datetime' || type === 'carbonimmutable') {
    return new Date().toISOString().slice(0, 10)
  }

  if (type === 'string' || type === '') {
    return ''
  }

  // A nested DTO or a model: an object is the right shape even though this
  // cannot say what goes in it.
  return {}
}
