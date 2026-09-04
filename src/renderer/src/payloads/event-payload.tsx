import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function EventPayload({ event }: PayloadProps) {
  return (
    <div className="stack">
      <div className="exception__class">{String(event.content.name ?? 'Event')}</div>
      <FieldTable fields={{ Event: event.content.event, Payload: event.content.payload }} />
    </div>
  )
}
