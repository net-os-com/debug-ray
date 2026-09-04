import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function JobEventPayload({ event }: PayloadProps) {
  return (
    <div className="stack">
      <div className="exception__class">{String(event.content.event_name ?? 'Job')}</div>
      <FieldTable fields={{ Job: event.content.job, Exception: event.content.exception }} />
    </div>
  )
}
