import type { IncomingMessage, ServerResponse } from 'node:http'
import type { MockChoices, MockHit, MockState } from '../../shared/mocks/types'
import { readBody } from '../read-body'
import { respondJson } from '../respond-json'
import { withContentType } from './content-type'
import { decide } from './decide'
import type { MockHitLog } from './hit-log'
import { isPrivateAddress } from './private-address'

export type MockRouteDeps = {
  state: () => MockState
  choices: () => MockChoices
  log: MockHitLog
  now: () => number
  wait: (ms: number) => Promise<void>
}

export async function mockRoute(req: IncomingMessage, res: ServerResponse, deps: MockRouteDeps): Promise<void> {
  if (!isPrivateAddress(req.socket.remoteAddress)) {
    respondJson(res, 403, { message: 'Mocks only answer this machine and its containers.' })

    return
  }

  const started = deps.now()
  const body = await readBody(req).catch(() => '')
  const method = req.method ?? 'GET'
  const decision = decide(deps.state(), deps.choices(), method, req.url ?? '/')

  const hit = (fields: Pick<MockHit, 'endpointId' | 'responseId' | 'status' | 'note'>): void => {
    deps.log.add({
      at: started,
      service: decision.service,
      method,
      path: decision.path,
      query: decision.query,
      durationMs: deps.now() - started,
      requestHeaders: headersOf(req),
      requestBody: body,
      ...fields,
    })
  }

  if (decision.kind === 'refuse') {
    respondJson(res, decision.status, { message: decision.message })
    hit({ endpointId: null, responseId: null, status: decision.status, note: decision.message })

    return
  }

  const { endpoint, response } = decision

  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
    const message = `${endpoint.name}: response '${response.name}' has status ${response.status}, which is not an HTTP status.`

    respondJson(res, 501, { message })
    hit({ endpointId: endpoint.id, responseId: response.id, status: 501, note: message })

    return
  }

  if (response.delayMs > 0) {
    await deps.wait(response.delayMs)
  }

  if (res.destroyed || req.socket.destroyed) {
    hit({
      endpointId: endpoint.id,
      responseId: response.id,
      status: 0,
      note: 'Client gave up before the answer',
    })

    return
  }

  res.writeHead(response.status, withContentType(response.headers, response.body))
  res.end(response.body)
  hit({ endpointId: endpoint.id, responseId: response.id, status: response.status, note: null })
}

function headersOf(req: IncomingMessage): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = []

  for (let index = 0; index + 1 < req.rawHeaders.length; index += 2) {
    pairs.push({ key: req.rawHeaders[index], value: req.rawHeaders[index + 1] })
  }

  return pairs
}
