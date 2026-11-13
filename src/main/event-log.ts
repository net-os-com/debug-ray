import {
  ANNOTATION_TYPES,
  OWN_VIEW,
  REQUEST_PAYLOAD_TYPE,
  isStreamEntry,
  type RayEvent,
  type StreamSnapshot,
} from '../shared/ray-event'

/** Outgoing calls, counted apart from the stream and from requests. */
const OWN_VIEW_CAPACITY = 500

/** How many of each list the log keeps, read on every record. */
export type EventLogCapacities = {
  /** The stream's buffer size from Settings. */
  stream: () => number
  /** The Requests view's buffer size from Settings. */
  requests: () => number
}

/**
 * A ceiling on labels and colours, which normally go when their event goes.
 * It only bites on annotations whose event never came — a source that is
 * ignored, a `confetti` — which would otherwise pile up for as long as the app
 * runs.
 */
const ANNOTATION_CAPACITY = 2_000

/**
 * The main process keeps the authoritative buffer. The renderer mirrors it for
 * display; the local API reads from here so an MCP client can pull payloads
 * without the window having to be open on the right screen, and the menu bar
 * panel reads from here so it works while the window is hidden or closed.
 *
 * It is four lists rather than one. A single list of the last 500 payloads of
 * every kind let an application that polls, or calls out, push every `ray()`
 * event out within minutes — one collected request or outgoing call counted the
 * same as a dump — while the window's stream, which counts stream events only,
 * still showed them. The panel and an MCP client then read "nothing" beside a
 * full stream. So stream events are capped on their own, at the stream's own
 * buffer size; requests likewise, at the Requests view's, since a reopened
 * window fills its Requests from here; outgoing calls have a cap of their own;
 * and labels and colours go when the events they decorate go.
 */
export class EventLog {
  private stream: RayEvent[] = []
  private requests: RayEvent[] = []
  private ownView: RayEvent[] = []
  private annotations: RayEvent[] = []

  /**
   * Capacities are read on every record rather than fixed here, so a buffer
   * size changed in Settings takes effect without a restart.
   */
  constructor(private readonly capacities: EventLogCapacities) {}

  record(events: RayEvent[]): void {
    for (const event of events) {
      if (ANNOTATION_TYPES.has(event.type)) {
        this.annotations.push(event)
      } else if (event.type === REQUEST_PAYLOAD_TYPE) {
        this.requests.push(event)
      } else if (OWN_VIEW.has(event.type)) {
        this.ownView.push(event)
      } else {
        this.stream.push(event)
      }
    }

    const evicted = [
      ...this.evict('stream', this.capacities.stream()),
      ...this.evict('requests', this.capacities.requests()),
      ...this.evict('ownView', OWN_VIEW_CAPACITY),
    ]

    this.dropAnnotationsOf(evicted)
    this.annotations = this.annotations.slice(-ANNOTATION_CAPACITY)
  }

  /** Everything, as a `clear_all` payload asks. */
  clear(): void {
    this.stream = []
    this.requests = []
    this.ownView = []
    this.annotations = []
  }

  /**
   * The collected requests only, as the Requests view's Clear asks, so a
   * window opened again afterwards does not bring them back.
   */
  clearRequests(): void {
    const cleared = this.requests

    this.requests = []
    this.dropAnnotationsOf(cleared)
  }

  /** Collected requests, oldest first, for a window that opens late. */
  requestsSnapshot(): RayEvent[] {
    return [...this.requests]
  }

  /**
   * The stream only, as Cmd-K asks. The Requests and HTTP views keep their
   * lists when the stream is cleared, so their payloads stay fetchable here.
   */
  clearStream(): void {
    const cleared = this.stream

    this.stream = []
    this.dropAnnotationsOf(cleared)
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
    return [...this.stream, ...this.requests, ...this.ownView, ...this.annotations]
  }

  /** Trims a list to its capacity, oldest first, and returns what it dropped. */
  private evict(list: 'stream' | 'requests' | 'ownView', capacity: number): RayEvent[] {
    const overflow = Math.max(0, this[list].length - capacity)
    const dropped = this[list].slice(0, overflow)

    this[list] = this[list].slice(overflow)

    return dropped
  }

  /**
   * Drops the labels and colours of events that just left, unless another
   * event of the same request is still here.
   *
   * Only what left, never "whatever has no event right now": the PHP client
   * can send the annotation first — `ray()->label('Cart')->table($cart)`
   * posts the label before the table, under the same uuid — and an annotation
   * judged by whether its event exists yet would be thrown away on arrival.
   */
  private dropAnnotationsOf(removed: RayEvent[]): void {
    if (removed.length === 0) {
      return
    }

    const remaining = new Set(
      [...this.stream, ...this.requests, ...this.ownView].map((event) => event.uuid),
    )
    const gone = new Set(
      removed.map((event) => event.uuid).filter((uuid) => !remaining.has(uuid)),
    )

    this.annotations = this.annotations.filter((event) => !gone.has(event.uuid))
  }
}
