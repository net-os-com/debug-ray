import type { ServerResponse } from 'node:http'
import { respondJson } from '../respond-json'

/**
 * The PHP client calls this with CURLOPT_FAILONERROR and treats an HTTP *error*
 * as "a Ray app is listening" (Client::performAvailabilityCheck). Answering 200
 * here makes the client conclude there is no server and drop every payload, so
 * this deliberately returns 404.
 */
export function availabilityCheck(res: ServerResponse): void {
  respondJson(res, 404, { message: 'Not found' })
}
