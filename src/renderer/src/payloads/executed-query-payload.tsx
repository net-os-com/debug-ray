import { FieldTable } from '../ui/field-table'
import type { PayloadProps } from './payload-props'

export function ExecutedQueryPayload({ event }: PayloadProps) {
  const { sql, bindings, connection_name, time } = event.content

  return (
    <div className="stack">
      <pre className="sql">{String(sql ?? '')}</pre>
      <FieldTable
        fields={{
          Bindings: bindings,
          Connection: connection_name,
          Time: typeof time === 'number' ? `${time} ms` : time,
        }}
      />
    </div>
  )
}
