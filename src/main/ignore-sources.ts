import type { RayEvent } from '../shared/ray-event'

/**
 * Drops payloads from senders you are not working on.
 *
 * Anything that posts to the port lands here, including other projects on the
 * same machine, so an entry is matched against both the hostname the payload
 * declares and the file it came from — whichever the sender happens to identify
 * itself by.
 *
 * Filtering here rather than in the renderer means an ignored source never
 * reaches the buffer, the local API or a notification.
 */
export function isIgnored(event: RayEvent, ignored: string[]): boolean {
  if (ignored.length === 0) {
    return false
  }

  const haystack = `${event.origin.hostname ?? ''}\n${event.origin.file ?? ''}`.toLowerCase()

  return ignored.some((entry) => haystack.includes(entry.toLowerCase()))
}
