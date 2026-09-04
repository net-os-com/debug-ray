import type { RayEvent } from '../../shared/ray-event'

/**
 * Several payloads travel as type `custom` or `table` and name themselves in
 * `content.label` (Image, HTML, Text, Cache, .env, ...).
 */
export function payloadLabel(event: RayEvent): string {
  const label = event.content.label

  if (typeof label === 'string' && label.trim() !== '') {
    return label
  }

  return event.type
}
