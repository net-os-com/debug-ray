export type FieldProblem = {
  field: string
  message: string
}

export type ResponseProblem = {
  /** The headline: the API's own message, or something true about the status. */
  title: string
  fields: FieldProblem[]
  /** The exception class, when the server was willing to name one. */
  exception: string | null
  /** `app/Http/Controllers/Thing.php:41`, when it said where. */
  location: string | null
}

/**
 * What went wrong, lifted out of the body.
 *
 * A 422 from Laravel is the most common failure this tab will show, and its
 * useful half — which field, and why — is three levels down a JSON tree. Reading
 * it out means the answer is the first thing on screen rather than something
 * you go looking for.
 */
export function problemOf(body: string, status: number): ResponseProblem | null {
  if (status < 400) {
    return null
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(body)
  } catch {
    return { title: titleFor(status), fields: [], exception: null, location: null }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { title: titleFor(status), fields: [], exception: null, location: null }
  }

  const shape = parsed as Record<string, unknown>
  const message = typeof shape.message === 'string' ? shape.message : ''

  return {
    title: message !== '' ? message : titleFor(status),
    fields: fieldsOf(shape.errors),
    exception: typeof shape.exception === 'string' ? shape.exception : null,
    location: locationOf(shape),
  }
}

/** `errors` is field => messages; only the first message per field is shown. */
function fieldsOf(errors: unknown): FieldProblem[] {
  if (typeof errors !== 'object' || errors === null) {
    return []
  }

  return Object.entries(errors as Record<string, unknown>).map(([field, value]) => ({
    field,
    message: Array.isArray(value) ? String(value[0] ?? '') : String(value),
  }))
}

function locationOf(shape: Record<string, unknown>): string | null {
  const file = typeof shape.file === 'string' ? shape.file : ''

  if (file === '') {
    return null
  }

  // The absolute path inside the container is the same forty characters on
  // every line; what differs is the part after the application root.
  const short = file.replace(/^.*?\/(?=app\/|vendor\/|routes\/|database\/)/, '')

  return typeof shape.line === 'number' ? `${short}:${shape.line}` : short
}

const TITLES: Record<number, string> = {
  400: 'Bad request',
  401: 'Unauthenticated',
  403: 'Forbidden',
  404: 'Not found',
  405: 'Method not allowed',
  409: 'Conflict',
  419: 'Page expired — the CSRF token is missing or stale',
  422: 'The given data was invalid',
  429: 'Too many requests',
  500: 'Server error',
  503: 'Service unavailable',
}

function titleFor(status: number): string {
  return TITLES[status] ?? (status >= 500 ? 'Server error' : 'Request failed')
}
