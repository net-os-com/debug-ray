import type {
  MockEndpoint,
  MockResponse,
  MockService,
  MockWebhook,
} from '../../../shared/mocks/types'

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function uniqueId(base: string, taken: string[]): string {
  const start = base === '' ? 'item' : base

  if (!taken.includes(start)) {
    return start
  }

  let n = 2

  while (taken.includes(`${start}-${n}`)) {
    n += 1
  }

  return `${start}-${n}`
}

export function newService(title: string, existing: MockService[]): MockService {
  return {
    name: uniqueId(
      slug(title),
      existing.map((one) => one.name),
    ),
    title,
    file: '',
    hash: null,
    endpoints: [],
    webhooks: [],
  }
}

function mapEndpoint(
  s: MockService,
  endpointId: string,
  change: (endpoint: MockEndpoint) => MockEndpoint,
): MockService {
  return {
    ...s,
    endpoints: s.endpoints.map((one) => (one.id === endpointId ? change(one) : one)),
  }
}

export function addEndpoint(
  s: MockService,
  method: string,
  path: string,
  name: string,
): { service: MockService; endpointId: string } {
  const endpointId = uniqueId(
    slug(name),
    s.endpoints.map((one) => one.id),
  )
  const endpoint: MockEndpoint = {
    id: endpointId,
    name,
    method,
    path,
    query: {},
    responses: [{ id: 'ok', name: 'OK', status: 200, headers: {}, delayMs: 0, body: '' }],
  }

  return { service: { ...s, endpoints: [...s.endpoints, endpoint] }, endpointId }
}

export function updateEndpoint(
  s: MockService,
  endpointId: string,
  patch: Partial<Omit<MockEndpoint, 'id' | 'responses'>>,
): MockService {
  return mapEndpoint(s, endpointId, (one) => ({ ...one, ...patch }))
}

export function removeEndpoint(s: MockService, endpointId: string): MockService {
  return { ...s, endpoints: s.endpoints.filter((one) => one.id !== endpointId) }
}

export function moveEndpoint(s: MockService, from: number, to: number): MockService {
  if (from === to || from < 0 || to < 0 || from >= s.endpoints.length || to >= s.endpoints.length) {
    return s
  }

  const endpoints = [...s.endpoints]
  const [moved] = endpoints.splice(from, 1)

  endpoints.splice(to, 0, moved)

  return { ...s, endpoints }
}

export function addResponse(
  s: MockService,
  endpointId: string,
  name: string,
): { service: MockService; responseId: string } {
  const taken = s.endpoints.find((one) => one.id === endpointId)?.responses.map((one) => one.id) ?? []
  const responseId = uniqueId(slug(name), taken)
  const response: MockResponse = {
    id: responseId,
    name,
    status: 200,
    headers: {},
    delayMs: 0,
    body: '',
  }

  return {
    service: mapEndpoint(s, endpointId, (one) => ({
      ...one,
      responses: [...one.responses, response],
    })),
    responseId,
  }
}

export function updateResponse(
  s: MockService,
  endpointId: string,
  responseId: string,
  patch: Partial<Omit<MockResponse, 'id'>>,
): MockService {
  return mapEndpoint(s, endpointId, (one) => ({
    ...one,
    responses: one.responses.map((response) =>
      response.id === responseId ? { ...response, ...patch } : response,
    ),
  }))
}

export function removeResponse(s: MockService, endpointId: string, responseId: string): MockService {
  return mapEndpoint(s, endpointId, (one) => ({
    ...one,
    responses: one.responses.filter((response) => response.id !== responseId),
  }))
}

export function addWebhook(
  s: MockService,
  name: string,
): { service: MockService; webhookId: string } {
  const webhookId = uniqueId(
    slug(name),
    s.webhooks.map((one) => one.id),
  )
  const webhook: MockWebhook = {
    id: webhookId,
    name,
    method: 'POST',
    path: '/',
    headers: {},
    body: '',
    signature: { kind: 'none', header: '', prefix: '', secretConfig: '' },
  }

  return { service: { ...s, webhooks: [...s.webhooks, webhook] }, webhookId }
}

export function updateWebhook(
  s: MockService,
  webhookId: string,
  patch: Partial<Omit<MockWebhook, 'id'>>,
): MockService {
  return {
    ...s,
    webhooks: s.webhooks.map((one) => (one.id === webhookId ? { ...one, ...patch } : one)),
  }
}

export function removeWebhook(s: MockService, webhookId: string): MockService {
  return { ...s, webhooks: s.webhooks.filter((one) => one.id !== webhookId) }
}
