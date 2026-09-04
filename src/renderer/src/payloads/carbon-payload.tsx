import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function CarbonPayload({ event }: PayloadProps) {
  const { formatted, timestamp, timezone } = event.content

  return <FieldTable fields={{ Formatted: formatted, Timestamp: timestamp, Timezone: timezone }} />
}
