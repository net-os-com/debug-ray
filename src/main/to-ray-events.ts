import { randomUUID } from 'node:crypto'
import type { RayEvent, RayRequest } from '../shared/ray-event'

/**
 * One incoming request can hold several payloads. The UI is a flat stream, so
 * each payload becomes its own event carrying the request's uuid and meta.
 */
export function toRayEvents(request: RayRequest): RayEvent[] {
  const receivedAt = Date.now()

  return (request.payloads ?? []).map((payload) => ({
    id: randomUUID(),
    uuid: request.uuid,
    receivedAt,
    type: payload.type,
    content: payload.content ?? {},
    origin: payload.origin ?? { file: null, line_number: null, hostname: null },
    meta: request.meta ?? {},
  }))
}
