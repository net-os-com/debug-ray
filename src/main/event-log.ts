import {
  ANNOTATION_TYPES,
  OWN_VIEW,
  isStreamEntry,
  type RayEvent,
  type StreamSnapshot,
} from '../shared/ray-event'

/** Collected requests and outgoing calls, counted apart from the stream. */
const OWN_VIEW_CAPACITY = 500

/**
 * The main process keeps the authoritative buffer. The renderer mirrors it for
 * display; the local API reads from here so an MCP client can pull payloads
 * without the window having to be open on the right screen, and the menu bar
 * panel reads from here so it works while the window is hidden or closed.
 *
 * It is three lists rather than one. A single list of the last 500 payloads of
 * every kind let an application that polls, or calls out, push every `ray()`
 * event out within minutes — one collected request or outgoing call counted the
 * same as a dump — while the window's stream, which counts stream events only,
 * still showed them. The panel and an MCP client then read "nothing" beside a
 * full stream. So stream events are capped on their own, at the stream's own
 * buffer size; requests and outgoing calls have a cap of their own; and labels
 * and colours are kept for exactly as long as something they decorate is.
 */
export class EventLog {
  private stream: RayEvent[] = []
  private ownView: RayEvent[] = []
  private annotations: RayEvent[] = []

  /**
   * The stream's capacity is read on every record rather than fixed here, so a
   * buffer size changed in Settings takes effect without a restart.
   */
  constructor(private readonly streamCapacity: () => number) {}

  record(events: RayEvent[]): void {
    for (const event of events) {
      if (ANNOTATION_TYPES.has(event.type)) {
        this.annotations.push(event)
      } else if (OWN_VIEW.has(event.type)) {
        this.ownView.push(event)
      } else {
        this.stream.push(event)
      }
    }

    this.stream = this.stream.slice(-this.streamCapacity())
    this.ownView = this.ownView.slice(-OWN_VIEW_CAPACITY)
    this.pruneAnnotations()
  }

  /** Everything, as a `clear_all` payload asks. */
  clear(): void {
    this.stream = []
    this.ownView = []
    this.annotations = []
  }

  /**
   * The stream only, as Cmd-K asks. The Requests and HTTP views keep their
   * lists when the stream is cleared, so their payloads stay fetchable here.
   */
  clearStream(): void {
    this.stream = []
    this.pruneAnnotations()
  }

  /**
   * Newest first, the way the stream reads. label and color payloads are
   * annotations on their sibling entry rather than entries of their own, and
   * collected requests belong to the Requests view, so both stay out of
   * listings unless asked for by name.
   */
  recent(limit: number, type?: string): RayEvent[] {
    // Any one type lives in exactly one list, so filtering the lists laid end
    // to end keeps that type's arrival order.
    const matching = type ? this.all().filter((event) => event.type === type) : this.stream

    return matching.slice(-limit).reverse()
  }

  get(id: string): RayEvent | null {
    return this.all().find((event) => event.id === id) ?? null
  }

  lastException(): RayEvent | null {
    for (let index = this.stream.length - 1; index >= 0; index -= 1) {
      if (this.stream[index].type === 'exception') {
        return this.stream[index]
      }
    }

    return null
  }

  /** ray()->label() and ->green() reuse the request uuid; resolve them here. */
  annotationsFor(uuid: string): { label: string | null; color: string | null } {
    let label: string | null = null
    let color: string | null = null

    for (const event of this.annotations) {
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

  /** What a window opening late needs to show the stream as it stands. */
  streamSnapshot(): StreamSnapshot {
    const labels: Record<string, string> = {}
    const colors: Record<string, string> = {}

    for (const event of this.annotations) {
      if (event.type === 'label' && typeof event.content.label === 'string') {
        labels[event.uuid] = event.content.label
      }

      if (event.type === 'color' && typeof event.content.color === 'string') {
        colors[event.uuid] = event.content.color
      }
    }

    return { events: this.stream.filter(isStreamEntry), labels, colors }
  }

  private all(): RayEvent[] {
    return [...this.stream, ...this.ownView, ...this.annotations]
  }

  /**
   * An annotation whose entry has gone decorates nothing. Dropping it here is
   * what keeps the annotations from outliving, or being outlived by, the
   * events they belong to.
   */
  private pruneAnnotations(): void {
    const kept = new Set([...this.stream, ...this.ownView].map((event) => event.uuid))

    this.annotations = this.annotations.filter((event) => kept.has(event.uuid))
  }
}
