import { activeResponse } from '../../shared/mocks/active'
import { matchEndpoint } from '../../shared/mocks/match'
import type { MockChoices, MockEndpoint, MockResponse, MockState } from '../../shared/mocks/types'

export type MockDecision =
  | {
      kind: 'answer'
      service: string
      endpoint: MockEndpoint
      response: MockResponse
      path: string
      query: string
    }
  | {
      kind: 'refuse'
      status: 501 | 503
      message: string
      service: string
      path: string
      query: string
    }

const PREFIX = '/mock/'

export function decide(state: MockState, choices: MockChoices, method: string, url: string): MockDecision {
  const split = url.indexOf('?')
  const target = split === -1 ? url : url.slice(0, split)
  const query = split === -1 ? '' : url.slice(split + 1)
  const rest = target.startsWith(PREFIX) ? target.slice(PREFIX.length) : ''
  const slash = rest.indexOf('/')
  const service = slash === -1 ? rest : rest.slice(0, slash)
  const path = decoded(slash === -1 ? '/' : rest.slice(slash))

  const refuse = (status: 501 | 503, message: string): MockDecision => ({
    kind: 'refuse',
    status,
    message,
    service,
    path,
    query,
  })

  if (state.error !== null) {
    return refuse(503, state.error)
  }

  if (state.loadedAt === null) {
    return refuse(503, 'Mocks are not loaded. Open NetOS Debug and pick a container in Settings.')
  }

  const found = state.services.find((one) => one.name === service)

  if (!found) {
    const known = state.services.map((one) => one.name).join(', ')

    return refuse(501, `No mock service '${service}'. Known: ${known || 'none'}.`)
  }

  const endpoint = matchEndpoint(found.endpoints, method, path, new URLSearchParams(query))

  if (!endpoint) {
    return refuse(501, `No mock for ${method.toUpperCase()} ${path}${query === '' ? '' : `?${query}`} in ${service}`)
  }

  const response = activeResponse(service, endpoint, choices)

  if (!response) {
    return refuse(501, `${endpoint.name} has no responses`)
  }

  return { kind: 'answer', service, endpoint, response, path, query }
}

function decoded(path: string): string {
  try {
    return decodeURIComponent(path)
  } catch {
    return path
  }
}
