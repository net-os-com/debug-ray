import { useEffect, useMemo, useRef } from 'react'
import type { RayEvent } from '../../../shared/ray-event'
import { groupEvents } from './group-events'
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

  const groups = useMemo(() => groupEvents(events, labels, colors), [events, labels, colors])

  // Newest sits on top, so "follow new events" means going back to the top.
  useEffect(() => {
    if (autoscroll) {
      scroller.current?.scrollTo({ top: 0 })
    }
  }, [autoscroll, events.length])

  return (
    <div className="stream" ref={scroller}>
      {groups.map((group) => (
        <StreamRow
          color={colors[group.event.uuid]}
          count={group.count}
          event={group.event}
          key={group.event.id}
          label={labels[group.event.uuid]}
          latestAt={group.latestAt}
          onSelect={() => onSelect(selectedId === group.event.id ? null : group.event.id)}
          selected={selectedId === group.event.id}
        />
      ))}
    </div>
  )
}
