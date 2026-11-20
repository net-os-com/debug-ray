import type { ApiResult } from '../api'

export type MockResponse = {
  id: string
  name: string
  status: number
  headers: Record<string, string>
  delayMs: number
  body: string
}

export type MockEndpoint = {
  id: string
  name: string
  method: string
  path: string
  query: Record<string, string>
  responses: MockResponse[]
}

export type SignatureKind = 'none' | 'hmac-sha256' | 'stripe'

export type MockSignature = {
  kind: SignatureKind
  header: string
  prefix: string
  secretConfig: string
}

export type MockWebhook = {
  id: string
  name: string
  method: string
  path: string
  headers: Record<string, string>
  body: string
  signature: MockSignature
}

export type MockService = {
  name: string
  title: string
  file: string
  hash: string | null
  endpoints: MockEndpoint[]
  webhooks: MockWebhook[]
}

export type MockProblem = { file: string; error: string }

export type MockState = {
  services: MockService[]
  problems: MockProblem[]
  directory: string
  container: string
  loadedAt: number | null
  error: string | null
}

export type MockChoices = Record<string, string>

export type MockHit = {
  id: string
  at: number
  service: string
  method: string
  path: string
  query: string
  endpointId: string | null
  responseId: string | null
  status: number
  durationMs: number
  requestHeaders: { key: string; value: string }[]
  requestBody: string
  note: string | null
}

export type WebhookFire = {
  containerId: string
  workingDir: string
  host: string
  insecure: boolean
  webhook: MockWebhook
}

export type WebhookOutcome = {
  webhookId: string
  at: number
  sent: boolean
  result: ApiResult | null
  error: string | null
  edited: boolean
}

export const EMPTY_STATE: MockState = {
  services: [],
  problems: [],
  directory: '',
  container: '',
  loadedAt: null,
  error: null,
}

export function choiceKey(service: string, endpointId: string): string {
  return `${service}/${endpointId}`
}
