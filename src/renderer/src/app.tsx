import { useEffect, useRef } from 'react'
import { EventRow } from './event-row'
import { useRayEvents } from './use-ray-events'
import { useServerStatus } from './use-server-status'

export function App() {
  const { events, clear } = useRayEvents()
  const status = useServerStatus()
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [events.length])

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__title">NetOS Ray</span>
        <span className="app__status">
          {status === null
            ? 'starting…'
            : status.error
              ? `error: ${status.error}`
              : status.listening
                ? `listening on ${status.host}:${status.port}`
                : 'not listening'}
        </span>
        <span className="app__count">{events.length} payloads</span>
        <button className="app__clear" onClick={clear} type="button">
          Clear
        </button>
      </header>

      {events.length === 0 ? (
        <p className="app__empty">
          Waiting for payloads. Send one with <code>ray('hello')</code>.
        </p>
      ) : (
        <ol className="app__events">
          {events.map((event) => (
            <EventRow event={event} key={event.id} />
          ))}
        </ol>
      )}

      <div ref={bottom} />
    </div>
  )
}
