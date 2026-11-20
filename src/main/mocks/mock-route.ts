import type { IncomingMessage, ServerResponse } from 'node:http'
import { EMPTY_STATE, type MockChoices, type MockHit, type MockState } from '../../shared/mocks/types'
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
  const started = deps.now()
  const method = req.method ?? 'GET'
  const url = req.url ?? '/'

  const record = (
    where: { service: string; path: string; query: string },
    body: string,
    fields: Pick<MockHit, 'endpointId' | 'responseId' | 'status' | 'note'>,
  ): void => {
    deps.log.add({
      at: started,
      service: where.service,
      method,
      path: where.path,
      query: where.query,
      durationMs: deps.now() - started,
      requestHeaders: headersOf(req),
      requestBody: body,
      ...fields,
    })
  }

  if (!isPrivateAddress(req.socket.remoteAddress)) {
    const message = 'Mocks only answer this machine and its containers.'

    respondJson(res, 403, { message })
    record(decide(EMPTY_STATE, {}, method, url), '', { endpointId: null, responseId: null, status: 403, note: message })

    return
  }

  const body = await readBody(req).catch(() => '')
  const decision = decide(deps.state(), deps.choices(), method, url)

  if (decision.kind === 'refuse') {
    respondJson(res, decision.status, { message: decision.message })
    record(decision, body, { endpointId: null, responseId: null, status: decision.status, note: decision.message })

    return
  }

  const { endpoint, response } = decision
  const answered = { endpointId: endpoint.id, responseId: response.id }

  if (!Number.isInteger(response.status) || response.status < 100 || response.status > 599) {
    const message = `${endpoint.name}: response '${response.name}' has status ${response.status}, which is not an HTTP status.`

    respondJson(res, 501, { message })
    record(decision, body, { ...answered, status: 501, note: message })

    return
  }

  try {
    if (response.delayMs > 0) {
      await deps.wait(response.delayMs)
    }

    if (res.destroyed || req.socket.destroyed) {
      record(decision, body, { ...answered, status: 0, note: 'Client gave up before the answer' })

      return
    }

    res.writeHead(response.status, withContentType(response.headers, response.body))
    res.end(response.body)
    record(decision, body, { ...answered, status: response.status, note: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (res.headersSent) {
      res.destroy()
    } else {
      respondJson(res, 500, { message })
    }

    record(decision, body, { ...answered, status: 500, note: message })
  }
}

function headersOf(req: IncomingMessage): { key: string; value: string }[] {
  const pairs: { key: string; value: string }[] = []

  for (let index = 0; index + 1 < req.rawHeaders.length; index += 2) {
    pairs.push({ key: req.rawHeaders[index], value: req.rawHeaders[index + 1] })
  }

  return pairs
}
