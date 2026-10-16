import type { ApiAuthMode, ApiPair, SavedRequest } from '../api'
import { isRecord, text } from './skeleton'

/**
 * An Insomnia v5 collection, read into saved requests.
 *
 * The format nests: `collection` holds requests and folders alike, and a folder
 * is simply an entry with `children`. That nesting is what this app calls a
 * folder path, so an import keeps the shape somebody already gave their
 * requests instead of flattening it into one list.
 *
 * What does not come across: environments, cookie jars, scripts and the
 * `{{ _.variable }}` references inside them. The references themselves survive
 * untouched in URLs and headers — unresolved, which is the point, because a
 * resolved secret is a secret in a committed file.
 */
export const INSOMNIA_TYPE = 'collection.insomnia.rest/'

export function fromInsomnia(document: Record<string, unknown>): SavedRequest[] {
  return walk(Array.isArray(document.collection) ? document.collection : [], '')
}

function walk(entries: unknown[], folder: string): SavedRequest[] {
  const requests: SavedRequest[] = []

  for (const entry of entries) {
    if (!isRecord(entry)) {
      continue
    }

    const name = text(entry.name)

    if (Array.isArray(entry.children)) {
      requests.push(...walk(entry.children, folder === '' ? name : `${folder}/${name}`))

      continue
    }

    const request = requestOf(entry, folder)

    if (request !== null) {
      requests.push(request)
    }
  }

  return requests
}

function requestOf(entry: Record<string, unknown>, folder: string): SavedRequest | null {
  const url = text(entry.url)

  if (url === '') {
    return null
  }

  const body = isRecord(entry.body) ? entry.body : {}
  const json = text(body.text)
  const isJson = text(body.mimeType).toLowerCase().includes('json')

  return {
    name: text(entry.name) || url,
    method: (text(entry.method) || 'GET').toUpperCase(),
    path: pathOf(url),
    pathParams: pairs(entry.pathParameters),
    query: pairs(entry.parameters),
    headers: pairs(entry.headers),
    bodyMode: isJson && json !== '' ? 'json' : 'none',
    json: isJson ? json : '',
    auth: authOf(entry.authentication),
    summary: summaryOf(entry, url),
    folder,
  }
}

/**
 * The path, out of a URL that is usually a template.
 *
 * `{{ _.baseUrl }}/flights` has no host to speak of, and neither does a request
 * written against a variable — so anything before the first slash that follows
 * the template is dropped, and what is left is the path this app sends against
 * whichever environment you pick.
 */
function pathOf(url: string): string {
  const withoutScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const withoutTemplate = withoutScheme.replace(/^\{\{[^}]*\}\}/, '')
  const slash = withoutTemplate.indexOf('/')
  // No slash at all: the whole thing was a host or a variable, and the path is
  // the root of it.
  const path = slash === -1 ? '/' : withoutTemplate.slice(slash)

  // The query is kept as parameters, which Insomnia already lists, so a copy of
  // it on the path would be sent twice.
  return path.split('?')[0] || '/'
}

/**
 * Where this came from, when the URL said something the path could not carry —
 * the host, or the variable that stands in for it.
 */
function summaryOf(entry: Record<string, unknown>, url: string): string {
  const meta = isRecord(entry.meta) ? entry.meta : {}
  const description = text(meta.description)
  const host = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0] ?? ''

  if (host === '') {
    return description
  }

  const note = `Imported from ${host}`

  return description === '' ? note : `${description} · ${note}`
}

/**
 * Insomnia names a pair `name`/`value` and switches one off with `disabled`,
 * which is the same row this app draws with a checkbox.
 */
function pairs(raw: unknown): ApiPair[] {
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.flatMap((one) => {
    if (!isRecord(one)) {
      return []
    }

    const key = text(one.name)

    return key === '' ? [] : [{ key, value: text(one.value), enabled: one.disabled !== true }]
  })
}

/**
 * Only the mode travels, and only when it is one this app has: a token or a
 * password in a collection file is the thing these imports are careful not to
 * write down.
 */
function authOf(authentication: unknown): ApiAuthMode {
  if (!isRecord(authentication)) {
    return 'none'
  }

  return ['bearer', 'oauth2', 'apikey'].includes(text(authentication.type).toLowerCase())
    ? 'bearer'
    : 'none'
}
