import type { ServerResponse } from 'node:http'
import { respondJson } from '../respond-json'

/**
 * Backs ray()->pause() and ray()->showWhen() style locks. We do not implement
 * pausing, and an unanswered lock would block the PHP process, so every lock
 * reports itself as released.
 */
export function locks(res: ServerResponse): void {
  respondJson(res, 200, { active: false, stop_execution: false })
}
