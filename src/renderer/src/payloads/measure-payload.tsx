import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function MeasurePayload({ event }: PayloadProps) {
  const { name, total_time, time_since_last_call } = event.content
  const maxTotal = event.content.max_memory_usage_during_total_time
  const maxSinceLast = event.content.max_memory_usage_since_last_call

  return (
    <FieldTable
      fields={{
        Name: name,
        'Total time': formatSeconds(total_time),
        'Time since last call': formatSeconds(time_since_last_call),
        'Max memory (total)': formatBytes(maxTotal),
        'Max memory (since last call)': formatBytes(maxSinceLast),
      }}
    />
  )
}

function formatSeconds(value: unknown): string | null {
  return typeof value === 'number' ? `${(value * 1000).toFixed(2)} ms` : null
}

function formatBytes(value: unknown): string | null {
  return typeof value === 'number' ? `${(value / 1024 / 1024).toFixed(2)} MB` : null
}
