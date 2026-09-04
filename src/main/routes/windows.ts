import type { ServerResponse } from 'node:http'
import { respondJson } from '../respond-json'

/** Ray supports multiple windows to send to; we only have one. */
export function windows(res: ServerResponse): void {
  respondJson(res, 200, [])
}
