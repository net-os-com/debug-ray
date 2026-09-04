import { RayValue } from './value'

export function FieldTable({ fields }: { fields: Record<string, unknown> }) {
  const rows = Object.entries(fields).filter(([, value]) => value !== undefined)

  if (rows.length === 0) {
    return null
  }

  return (
    <dl className="field-table">
      {rows.map(([key, value]) => (
        <div className="field-table__row" key={key}>
          <dt>{key}</dt>
          <dd>
            <RayValue value={value} allowHtml />
          </dd>
        </div>
      ))}
    </dl>
  )
}
