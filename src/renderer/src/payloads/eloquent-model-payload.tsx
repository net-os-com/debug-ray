import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function EloquentModelPayload({ event }: PayloadProps) {
  const { class_name, attributes, relations } = event.content

  return (
    <div className="stack">
      <div className="exception__class">{String(class_name ?? 'Model')}</div>
      <FieldTable fields={{ Attributes: attributes, Relations: relations }} />
    </div>
  )
}
