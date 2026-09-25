import { formatDuration } from '../duration'
import type { HttpRequest } from './types'

export function EventsTab({ request }: { request: HttpRequest }) {
  if (request.events.length === 0) {
    return <div className="tab-pane"><div className="pane__none">No events were recorded for this request.</div></div>
  }

  return (
    <div className="tab-pane">
      <div className="card">
        {request.events.map((event) => (
          <div className="event-row" key={event.name}>
            <span className="event-row__at">{formatDuration(event.offsetMs)}</span>
            <div className="event-row__body">
              <div className="event-row__head">
                <span className="event-row__name">{event.name}</span>
                {event.count > 1 ? <span className="pill">×{event.count}</span> : null}
              </div>
              <div className="event-row__listeners">
                {event.listeners.length === 0 ? (
                  <span className="event-row__none">No listeners</span>
                ) : (
                  event.listeners.map((listener) => (
                    <span className="chip" key={listener}>
                      {listener}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
