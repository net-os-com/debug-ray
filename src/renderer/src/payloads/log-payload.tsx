import { RayValue } from '../ui/value'
import type { PayloadProps } from './payload-props'

export function LogPayload({ event }: PayloadProps) {
  const values = Array.isArray(event.content.values) ? event.content.values : []

  return (
    <div className="stack">
      {values.map((value, index) => (
        <RayValue key={index} value={value} />
      ))}
    </div>
  )
}
