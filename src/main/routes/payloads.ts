import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RayRequest } from '../../shared/ray-event'
import { readBody } from '../read-body'
import { respondJson } from '../respond-json'

export type PayloadsHandler = (request: RayRequest) => void

/** Receives the JSON body the PHP client POSTs to `/`. */
export async function payloads(
  req: IncomingMessage,
  res: ServerResponse,
  onRequest: PayloadsHandler,
): Promise<void> {
  let body: string

  try {
    body = await readBody(req)
  } catch (error) {
    respondJson(res, 413, { message: String(error) })

    return
  }

  try {
    onRequest(JSON.parse(body) as RayRequest)
  } catch {
    respondJson(res, 400, { message: 'Body is not valid JSON' })

    return
  }

  respondJson(res, 200, {})
}
