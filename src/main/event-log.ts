import type { RayEvent } from '../shared/ray-event'

/** Matches the renderer's buffer, so both show the same history. */
const CAPACITY = 500

const ANNOTATIONS = new Set(['label', 'color'])

/**
 * The main process keeps the authoritative buffer. The renderer mirrors it for
 * display; the local API reads from here so an MCP client can pull payloads
 * without the window having to be open on the right screen.
 */
export class EventLog {
  private events: RayEvent[] = []

  record(events: RayEvent[]): void {
    this.events = [...this.events, ...events].slice(-CAPACITY)
  }

  clear(): void {
    this.events = []
  }

  /**
   * Newest first, the way the stream reads. label and color payloads are
   * annotations on their sibling entry rather than entries of their own, so
   * they stay out of listings unless asked for by name.
   */
  recent(limit: number, type?: string): RayEvent[] {
    const matching = type
      ? this.events.filter((event) => event.type === type)
      : this.events.filter((event) => !ANNOTATIONS.has(event.type))

    return matching.slice(-limit).reverse()
  }

  get(id: string): RayEvent | null {
    return this.events.find((event) => event.id === id) ?? null
  }

  lastException(): RayEvent | null {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      if (this.events[index].type === 'exception') {
        return this.events[index]
      }
    }

    return null
  }

  /** ray()->label() and ->green() reuse the request uuid; resolve them here. */
  annotationsFor(uuid: string): { label: string | null; color: string | null } {
    let label: string | null = null
    let color: string | null = null

    for (const event of this.events) {
      if (event.uuid !== uuid) {
        continue
      }

      if (event.type === 'label' && typeof event.content.label === 'string') {
        label = event.content.label
      }

      if (event.type === 'color' && typeof event.content.color === 'string') {
        color = event.content.color
      }
    }

    return { label, color }
  }
}
