import { useEffect, useRef } from 'react'
import type { RayEvent } from '../../../shared/ray-event'
import { StreamRow } from './stream-row'

type EventStreamProps = {
  events: RayEvent[]
  labels: Record<string, string>
  colors: Record<string, string>
  selectedId: string | null
  autoscroll: boolean
  onSelect: (id: string | null) => void
}

export function EventStream({
  events,
  labels,
  colors,
  selectedId,
  autoscroll,
  onSelect,
}: EventStreamProps) {
  const scroller = useRef<HTMLDivElement>(null)

  // Newest sits on top, so "follow new events" means going back to the top.
  useEffect(() => {
    if (autoscroll) {
      scroller.current?.scrollTo({ top: 0 })
    }
  }, [autoscroll, events.length])

  return (
    <div className="stream" ref={scroller}>
      {events.map((event) => (
        <StreamRow
          color={colors[event.uuid]}
          event={event}
          key={event.id}
          label={labels[event.uuid]}
          onSelect={() => onSelect(selectedId === event.id ? null : event.id)}
          selected={selectedId === event.id}
        />
      ))}
    </div>
  )
}
