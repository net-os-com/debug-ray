import { RayValue } from '../ui/value'
import type { PayloadProps } from './payload-props'

export function ApplicationLogPayload({ event }: PayloadProps) {
  return (
    <div className="stack">
      <RayValue value={event.content.value} />
      {event.content.context ? <RayValue value={event.content.context} /> : null}
    </div>
  )
}
