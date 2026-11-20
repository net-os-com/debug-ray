import type {
  MockEndpoint,
  MockProblem,
  MockResponse,
  MockService,
  MockSignature,
  MockWebhook,
  SignatureKind,
} from './types'

const KINDS = new Set<string>(['none', 'hmac-sha256', 'stripe'])

/**
 * Reads the package's JSON into the model.
 *
 * Tolerant like the rest of what crosses a boundary: PHP writes an empty map
 * as `[]`, and a field that is missing or the wrong shape falls back to a
 * default instead of failing the whole list.
 */
export function toServices(raw: unknown): MockService[] {
  return list(raw).flatMap((one) => {
    const name = text(one.name)

    return name === ''
      ? []
      : [
          {
            name,
            title: text(one.title) || name,
            file: text(one.file),
            hash: typeof one.hash === 'string' && one.hash !== '' ? one.hash : null,
            endpoints: list(one.endpoints).map(endpoint),
            webhooks: list(one.webhooks).map(webhook),
          },
        ]
  })
}

export function toProblems(raw: unknown): MockProblem[] {
  return list(raw).map((one) => ({ file: text(one.file), error: text(one.error) }))
}

function endpoint(raw: Record<string, unknown>): MockEndpoint {
  return {
    id: text(raw.id),
    name: text(raw.name),
    method: text(raw.method).toUpperCase() || 'GET',
    path: text(raw.path) || '/',
    query: map(raw.query),
    responses: list(raw.responses).map(response),
  }
}

function response(raw: Record<string, unknown>): MockResponse {
  return {
    id: text(raw.id),
    name: text(raw.name),
    status: count(raw.status, 200),
    headers: map(raw.headers),
    delayMs: count(raw.delayMs, 0),
    body: text(raw.body),
  }
}

function webhook(raw: Record<string, unknown>): MockWebhook {
  return {
    id: text(raw.id),
    name: text(raw.name),
    method: text(raw.method).toUpperCase() || 'POST',
    path: text(raw.path) || '/',
    headers: map(raw.headers),
    body: text(raw.body),
    signature: signature(raw.signature),
  }
}

function signature(raw: unknown): MockSignature {
  const one = record(raw)
  const kind = text(one.kind)

  return {
    kind: KINDS.has(kind) ? (kind as SignatureKind) : 'none',
    header: text(one.header),
    prefix: text(one.prefix),
    secretConfig: text(one.secretConfig),
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((one) => typeof one === 'object' && one !== null && !Array.isArray(one))
    : []
}

function map(value: unknown): Record<string, string> {
  const out: Record<string, string> = {}

  for (const [key, one] of Object.entries(record(value))) {
    if (typeof one === 'string' || typeof one === 'number' || typeof one === 'boolean') {
      out[key] = String(one)
    }
  }

  return out
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function count(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}
