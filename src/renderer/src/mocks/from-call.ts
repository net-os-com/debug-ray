import type { OutgoingCall } from '../../../shared/http-client'
import { matchEndpoint } from '../../../shared/mocks/match'
import type { MockEndpoint, MockResponse, MockService } from '../../../shared/mocks/types'
import { addResponse, decodeQuery, slug, uniqueId, updateResponse } from './edit-service'

export const TRANSPORT_HEADERS: readonly string[] = [
  'date',
  'content-length',
  'connection',
  'transfer-encoding',
  'keep-alive',
]

const TRUNCATED = /\n\n‹truncated at \d+ bytes›$/

export function isTruncated(body: string): boolean {
  return TRUNCATED.test(body)
}

function isLeftOut(key: string, value: string): boolean {
  return TRANSPORT_HEADERS.includes(key.toLowerCase()) || value.startsWith('‹redacted')
}

export function responseFromCall(
  call: OutgoingCall,
  name: string,
  takenIds: string[],
): { response: MockResponse; dropped: string[] } {
  const headers: Record<string, string> = {}
  const dropped: string[] = []

  for (const { key, value } of call.responseHeaders) {
    if (isLeftOut(key, value)) {
      dropped.push(key)
    } else {
      headers[key] = value
    }
  }

  return {
    response: {
      id: uniqueId(slug(name), takenIds),
      name,
      status: call.status,
      headers,
      delayMs: 0,
      body: call.responseBody,
    },
    dropped,
  }
}

export function endpointFor(
  services: MockService[],
  call: OutgoingCall,
): { service: string; endpointId: string } | null {
  const url = new URL(call.url)

  for (const service of services) {
    const found = matchEndpoint(service.endpoints, call.method, url.pathname, url.searchParams)

    if (found !== null) {
      return { service: service.name, endpointId: found.id }
    }
  }

  return null
}

export function endpointFromCall(call: OutgoingCall, takenIds: string[]): MockEndpoint {
  const url = new URL(call.url)
  const name = `${call.method} ${url.pathname}`

  return {
    id: uniqueId(slug(name), takenIds),
    name,
    method: call.method,
    path: url.pathname,
    query: decodeQuery(url.search),
    responses: [],
  }
}

/** The call as one more response, on the given endpoint or on a new one when `endpointId` is null. */
export function applyCall(
  service: MockService,
  call: OutgoingCall,
  endpointId: string | null,
  name: string,
  body: string,
): MockService {
  const endpoint = endpointFromCall(
    call,
    service.endpoints.map((one) => one.id),
  )
  const target = endpointId ?? endpoint.id
  const withEndpoint =
    endpointId === null ? { ...service, endpoints: [...service.endpoints, endpoint] } : service
  const added = addResponse(withEndpoint, target, name)
  const { response } = responseFromCall(call, name, [])

  return updateResponse(added.service, target, added.responseId, {
    status: response.status,
    headers: response.headers,
    body,
  })
}
