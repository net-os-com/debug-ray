import { globMatches } from './glob'
import type { MockEndpoint } from './types'

export function matchEndpoint(
  endpoints: MockEndpoint[],
  method: string,
  path: string,
  query: URLSearchParams,
): MockEndpoint | null {
  const verb = method.toUpperCase()

  return (
    endpoints.find(
      (endpoint) =>
        endpoint.method.toUpperCase() === verb &&
        globMatches(endpoint.path, path) &&
        Object.entries(endpoint.query).every(([key, pattern]) =>
          query.getAll(key).some((value) => globMatches(pattern, value)),
        ),
    ) ?? null
  )
}
