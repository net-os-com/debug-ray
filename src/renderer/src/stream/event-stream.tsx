import { useEffect, useMemo, useRef } from 'react'
import type { RayEvent } from '../../../shared/ray-event'
import type { StreamOrder } from '../filter-events'
import { groupEvents } from './group-events'
import { StreamRow } from './stream-row'

type EventStreamProps = {
  events: RayEvent[]
  labels: Record<string, string>
  colors: Record<string, string>
  selectedId: string | null
  autoscroll: boolean
  order: StreamOrder
  onSelect: (id: string | null) => void
}

export function EventStream({
  events,
  labels,
  colors,
  selectedId,
  autoscroll,
  order,
  onSelect,
}: EventStreamProps) {
  const scroller = useRef<HTMLDivElement>(null)

  const groups = useMemo(
    () => groupEvents(events, labels, colors, order),
    [events, labels, colors, order],
  )

  // "Follow new events" means going to whichever end the new ones arrive at,
  // which is the top with the newest first and the bottom with the oldest.
  useEffect(() => {
    if (autoscroll) {
      scroller.current?.scrollTo({ top: order === 'newest' ? 0 : scroller.current.scrollHeight })
    }
  }, [autoscroll, order, events.length])

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
