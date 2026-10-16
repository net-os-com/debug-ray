import type { ApiAuthMode, ApiBodyMode, ApiPair, SavedRequest } from '../api'
import { isRecord, refsOf, skeletonOf, text } from './skeleton'

/**
 * Somebody else's OpenAPI or Swagger document, read into saved requests.
 *
 * The opposite problem from the documents this app writes: a spec from a
 * generator or a vendor, where almost everything is optional and the useful
 * parts live in different places per version. The result is requests somebody
 * can send, not a faithful model of the spec — a schema becomes an example
 * body, a tag becomes a folder, and a security requirement becomes "this one
 * needs a token".
 */
const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options']

export function fromOpenApi(document: Record<string, unknown>): SavedRequest[] {
  const paths = isRecord(document.paths) ? document.paths : {}
  const prefix = basePath(document)
  const secured = Array.isArray(document.security) && document.security.length > 0
  const requests: SavedRequest[] = []

  for (const [path, operations] of Object.entries(paths)) {
    if (!isRecord(operations)) {
      continue
    }

    // Parameters declared once for every verb on this path.
    const shared = Array.isArray(operations.parameters) ? operations.parameters : []

    for (const [verb, operation] of Object.entries(operations)) {
      if (!isRecord(operation) || !VERBS.includes(verb.toLowerCase())) {
        continue
      }

      requests.push(requestOf(prefix + path, verb, operation, shared, secured, document))
    }
  }

  return requests
}

/**
 * The base path every operation hangs off.
 *
 * OpenAPI 3 puts it inside a server URL, which is usually absolute; Swagger 2
 * keeps it in `basePath`. Only the path part is taken either way — the host
 * belongs to the environment you pick in this app, not to the file.
 */
function basePath(document: Record<string, unknown>): string {
  const servers = document.servers

  if (Array.isArray(servers) && isRecord(servers[0])) {
    const url = text(servers[0].url)

    if (url.startsWith('/')) {
      return url.replace(/\/+$/, '')
    }

    // A server URL may itself be a template — `{scheme}://{host}/v1` — so the
    // path is whatever follows the authority, if anything does.
    const after = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    const slash = after.indexOf('/')

    return slash === -1 ? '' : after.slice(slash).replace(/\/+$/, '')
  }

  return text(document.basePath).replace(/\/+$/, '')
}

function requestOf(
  path: string,
  verb: string,
  operation: Record<string, unknown>,
  shared: unknown[],
  secured: boolean,
  document: Record<string, unknown>,
): SavedRequest {
  const own = Array.isArray(operation.parameters) ? operation.parameters : []
  const parameters = [...shared, ...own]
  const json = bodyOf(operation, document)
  const tags = Array.isArray(operation.tags) ? operation.tags : []
  const needsToken =
    secured || (Array.isArray(operation.security) && operation.security.length > 0)
  // A document this app wrote carries what OpenAPI has no field for: which body
  // editor was open and how the request authenticates. Importing one of our own
  // files — a colleague's collection, say — should not lose that.
  const ours = isRecord(operation['x-netos-debug']) ? operation['x-netos-debug'] : null

  return {
    name: (ours === null ? '' : text(ours.name)) || nameOf(operation, verb, path),
    method: verb.toUpperCase(),
    path: path.startsWith('/') ? path : `/${path}`,
    pathParams: pairsIn(parameters, 'path'),
    query: pairsIn(parameters, 'query'),
    headers: pairsIn(parameters, 'header'),
    bodyMode: mode(ours, json),
    json,
    auth: authOf(ours, needsToken),
    summary: text(operation.description),
    // The first tag, which is how a generator groups a spec and how this app
    // draws a folder.
    folder: typeof tags[0] === 'string' ? tags[0] : '',
  }
}

function mode(ours: Record<string, unknown> | null, json: string): ApiBodyMode {
  const stored = ours === null ? '' : text(ours.bodyMode)

  if (stored === 'none' || stored === 'json' || stored === 'form') {
    return stored
  }

  return json === '' ? 'none' : 'json'
}

function authOf(ours: Record<string, unknown> | null, needsToken: boolean): ApiAuthMode {
  const stored = ours === null ? '' : text(ours.auth)

  if (stored === 'none' || stored === 'bearer' || stored === 'impersonate') {
    return stored
  }

  return needsToken ? 'bearer' : 'none'
}

function nameOf(operation: Record<string, unknown>, verb: string, path: string): string {
  for (const key of ['summary', 'operationId'] as const) {
    const name = text(operation[key])

    if (name !== '') {
      return name
    }
  }

  return `${verb.toUpperCase()} ${path}`
}

/**
 * A body to start from.
 *
 * An example if the document has one, and otherwise one built from the schema:
 * a generator rarely writes examples, and a POST with no body at all is a
 * request nobody can send without reading the spec themselves.
 */
function bodyOf(operation: Record<string, unknown>, document: Record<string, unknown>): string {
  const body = operation.requestBody
  const content = isRecord(body) && isRecord(body.content) ? body.content : null

  if (content !== null) {
    for (const [type, media] of Object.entries(content)) {
      if (!isRecord(media) || !type.toLowerCase().includes('json')) {
        continue
      }

      const examples = isRecord(media.examples) ? media.examples : null
      const named = examples !== null && isRecord(examples.default) ? examples.default.value : null
      const example = media.example ?? named

      if (example !== undefined && example !== null) {
        return encode(example)
      }

      if (isRecord(media.schema)) {
        return encode(skeletonOf(media.schema, 0, refsOf(document)))
      }
    }

    return ''
  }

  // Swagger 2: the body is one of the parameters.
  for (const parameter of Array.isArray(operation.parameters) ? operation.parameters : []) {
    if (isRecord(parameter) && parameter.in === 'body' && isRecord(parameter.schema)) {
      return encode(skeletonOf(parameter.schema, 0, refsOf(document)))
    }
  }

  return ''
}

function encode(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function pairsIn(parameters: unknown[], where: string): ApiPair[] {
  const pairs: ApiPair[] = []

  for (const parameter of parameters) {
    if (!isRecord(parameter) || parameter.in !== where) {
      continue
    }

    const key = text(parameter.name)

    if (key === '') {
      continue
    }

    const schema = isRecord(parameter.schema) ? parameter.schema : {}
    const value = parameter.example ?? schema.example ?? schema.default ?? parameter.default

    pairs.push({
      key,
      value: text(value),
      // A query parameter the spec does not require is a row you probably do
      // not want sent on the first try.
      enabled: where !== 'query' || parameter.required === true,
    })
  }

  return pairs
}
