import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function TablePayload({ event }: PayloadProps) {
  const values = event.content.values

  if (values === null || typeof values !== 'object') {
    return null
  }

  return <FieldTable fields={values as Record<string, unknown>} />
}
