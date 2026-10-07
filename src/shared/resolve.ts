import type { ApiVariable } from './api'

/** `{{ name }}`, with any amount of space inside the braces. */
const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g

/**
 * Substitutes an environment's variables into a string.
 *
 * A name nothing defines is left standing rather than replaced with emptiness:
 * a URL that still reads `{{ tenant }}` says what is missing, where one that
 * quietly became `https://api.example.test//me` says only that something is
 * wrong somewhere.
 */
export function resolve(text: string, variables: ApiVariable[]): string {
  const values = new Map(variables.map((variable) => [variable.key, variable.value]))

  return text.replace(PLACEHOLDER, (whole, name: string) => values.get(name) ?? whole)
}

/** Every name the text asks for that the environment does not define. */
export function missing(text: string, variables: ApiVariable[]): string[] {
  const known = new Set(variables.filter((variable) => variable.value !== '').map((v) => v.key))
  const wanted = [...text.matchAll(PLACEHOLDER)].map((match) => match[1])

  return [...new Set(wanted.filter((name) => !known.has(name)))]
}

/**
 * The URL a request will actually be sent to.
 *
 * Path parameters are `{id}` in OpenAPI's single braces, which is deliberately
 * not the variable syntax: one comes from the route, the other from the
 * environment, and confusing them makes `{{ tenant }}` a path parameter.
 */
export function buildUrl(
  host: string,
  path: string,
  pathParams: { key: string; value: string }[],
  query: { key: string; value: string; enabled: boolean }[],
  variables: ApiVariable[],
): string {
  const values = new Map(pathParams.map((one) => [one.key, one.value]))
  const withParams = resolve(path, variables).replace(
    /\{([^{}]+)\}/g,
    (whole, name: string) => encodeURIComponent(values.get(name) ?? '') || whole,
  )

  const base = resolve(host, variables).replace(/\/+$/, '')
  const joined = withParams.startsWith('/') ? withParams : `/${withParams}`

  const pairs = query
    .filter((one) => one.enabled && one.key.trim() !== '')
    .map(
      (one) =>
        `${encodeURIComponent(one.key)}=${encodeURIComponent(resolve(one.value, variables))}`,
    )

  return pairs.length === 0 ? `${base}${joined}` : `${base}${joined}?${pairs.join('&')}`
}
