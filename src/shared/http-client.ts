/**
 * One call the application made to somewhere else.
 *
 * Shipped per call by the Laravel package as it finishes, whether it happened
 * during a request, inside a queued job, or from a command — which is why the
 * context travels with it instead of being inferred here.
 */
export type OutgoingCall = {
  /** Assigned on arrival: the payload carries no id of its own. */
  id: string
  receivedAt: number
  method: string
  url: string
  host: string
  path: string
  query: string
  requestHeaders: { key: string; value: string }[]
  requestBody: string
  /** Zero when the call never got an answer. */
  status: number
  reason: string
  responseHeaders: { key: string; value: string }[]
  responseBody: string
  /** Why there is no answer, when there is none. */
  error: string | null
  durationMs: number
  startedAt: number
  /** Milliseconds per phase, as curl measured them. Empty for a faked call. */
  timing: Record<string, number>
  context: OutgoingContext
  /** The tenant that was current, in an application that has them. */
  tenant: string | null
  /** Where the call was made from, nearest frame first. */
  trace: TraceFrame[]
}

export type TraceFrame = {
  function: string
  file: string
  line: number
  /** Somebody else's code: foldable, because a call through an SDK is mostly this. */
  vendor: boolean
}

export type OutgoingContext = {
  kind: 'request' | 'queue' | 'console' | 'unknown'
  /** `POST /api/bookings`, a job class, a command — or nothing at all. */
  name: string | null
}

const KINDS = new Set(['request', 'queue', 'console', 'unknown'])

/**
 * Reads one payload into the view's contract.
 *
 * Nothing is trusted: the package and the app are versioned apart, so a field
 * that is missing or the wrong shape makes for a duller row rather than a
 * crash in the middle of the list.
 */
/**
 * A verb, and nothing else.
 *
 * Payloads arrive over a socket this app listens on, so `method` is not
 * something to be trusted because Laravel usually sends `GET`. It ends up in a
 * cURL command somebody is invited to paste into a terminal, and
 * `GET'; rm -rf ~; echo '` would read as three commands there. A method that is
 * not letters is not a method.
 */
const METHOD = /^[A-Za-z]{1,20}$/

export function toOutgoingCall(content: Record<string, unknown>, id: string): OutgoingCall | null {
  const method = text(content.method)
  const url = text(content.url)

  if (!METHOD.test(method) || url === '') {
    return null
  }

  return {
    id,
    receivedAt: Date.now(),
    method: method.toUpperCase(),
    url,
    host: text(content.host),
    path: text(content.path) || '/',
    query: text(content.query),
    requestHeaders: pairs(content.requestHeaders),
    requestBody: text(content.requestBody),
    status: count(content.status),
    reason: text(content.reason),
    responseHeaders: pairs(content.responseHeaders),
    responseBody: text(content.responseBody),
    error: typeof content.error === 'string' && content.error !== '' ? content.error : null,
    durationMs: count(content.durationMs),
    startedAt: count(content.startedAt),
    timing: timing(content.timing),
    context: context(content.context),
    tenant: typeof content.tenant === 'string' && content.tenant !== '' ? content.tenant : null,
    trace: frames(content.trace),
  }
}

function frames(value: unknown): TraceFrame[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((one) => {
    if (typeof one !== 'object' || one === null) {
      return []
    }

    const frame = one as Record<string, unknown>
    const file = text(frame.file)

    return file === ''
      ? []
      : [
          {
            function: text(frame.function) || '{closure}',
            file,
            line: count(frame.line),
            vendor: frame.vendor === true,
          },
        ]
  })
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function pairs(value: unknown): { key: string; value: string }[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((one) => {
    if (typeof one !== 'object' || one === null) {
      return []
    }

    const key = text((one as Record<string, unknown>).key)

    return key === '' ? [] : [{ key, value: text((one as Record<string, unknown>).value) }]
  })
}

function timing(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }

  const out: Record<string, number> = {}

  for (const [phase, ms] of Object.entries(value as Record<string, unknown>)) {
    if (typeof ms === 'number' && Number.isFinite(ms)) {
      out[phase] = ms
    }
  }

  return out
}

function context(value: unknown): OutgoingContext {
  if (typeof value !== 'object' || value === null) {
    return { kind: 'unknown', name: null }
  }

  const raw = value as Record<string, unknown>
  const kind = text(raw.kind)
  const name = text(raw.name)

  return {
    kind: KINDS.has(kind) ? (kind as OutgoingContext['kind']) : 'unknown',
    name: name === '' ? null : name,
  }
}
