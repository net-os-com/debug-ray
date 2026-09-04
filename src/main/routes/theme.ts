import type { ServerResponse } from 'node:http'
import { respondJson } from '../respond-json'

/** Lets the client mirror the app theme. We do not expose one yet. */
export function theme(res: ServerResponse): void {
  respondJson(res, 200, {})
}
