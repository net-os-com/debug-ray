import type { RayEvent } from '../../shared/ray-event'
import { originLabel } from './origin-label'
import { payloadLabel } from './payload-label'
import { PayloadView } from './payload-view'

export function EventRow({ event }: { event: RayEvent }) {
  return (
    <li className="event">
      <header className="event__header">
        <span className="event__label">{payloadLabel(event)}</span>
        <span className="event__origin" title={event.origin.file ?? ''}>
          {originLabel(event.origin)}
        </span>
        <time className="event__time">{formatTime(event.receivedAt)}</time>
      </header>
      <div className="event__body">
        <PayloadView event={event} />
      </div>
    </li>
  )
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, { hour12: false })
}
