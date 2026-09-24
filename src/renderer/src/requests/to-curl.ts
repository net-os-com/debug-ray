import type { HttpRequest } from './types'

/** Rebuilds the request as a shell command. Quotes are escaped for sh. */
export function toCurl(request: HttpRequest): string {
  const url = `https://${request.host}${request.uri}`
  const parts = ['curl']

  if (request.method !== 'GET') {
    parts.push('-X', request.method)
  }

  parts.push(quote(url))

  return parts.join(' ')
}

function quote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}
